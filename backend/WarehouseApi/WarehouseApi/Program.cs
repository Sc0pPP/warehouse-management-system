using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using WarehouseApi.Data;
using WarehouseApi.DTO;
using WarehouseApi.Models;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddOpenApi();
builder.Services.AddDbContext<WarehouseDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Default")));

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidateAudience = false,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]))
        };
    });


builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
        policy.WithOrigins("http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod());
});

builder.Services.AddAuthorization();

var app = builder.Build();
app.UseCors("AllowFrontend");
app.UseAuthentication();  // сначала: кто ты?
app.UseAuthorization();   // потом: что тебе разрешено?


//Auth
// Единственный публичный эндпоинт — тут пока нет токена, поэтому и
// .RequireAuthorization() на нём быть не может: иначе не выдать сам токен.
app.MapPost("/api/auth/login", (LoginRequest request, WarehouseDbContext context) =>
{
    // Проекция через Select вместо полной сущности User — обходит баг
    // материализации: EF Core 10 / Npgsql 10 на этой связке пытается
    // прочитать nullable warehouse_id как обычный int при загрузке целой
    // сущности (даже без Include), а через Select читает корректно.
    var user = context.Users
        .Where(u => u.Username == request.Username)
        .Select(u => new
        {
            u.Id,
            u.Username,
            u.PasswordHash,
            u.FullName,
            u.IsActive,
            u.WarehouseId,
            RoleName = u.Role.Name
        })
        .FirstOrDefault();

    if (user is null || !user.IsActive || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
    {
        return Results.Unauthorized();
    }

    // List, а не массив — потому что claim про warehouseId добавляется
    // условно (его нет вообще у Админа, а не "пустое значение").
    var claims = new List<Claim>
    {
        new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
        new Claim(ClaimTypes.Name, user.Username),
        new Claim(ClaimTypes.Role, user.RoleName),
    };
    if (user.WarehouseId is not null)
    {
        claims.Add(new Claim("warehouseId", user.WarehouseId.Value.ToString()));
    }

    var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]));
    var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
    var token = new JwtSecurityToken(
        issuer: builder.Configuration["Jwt:Issuer"],
        claims: claims,
        expires: DateTime.UtcNow.AddHours(8),
        signingCredentials: creds);

    return Results.Ok(new
    {
        token = new JwtSecurityTokenHandler().WriteToken(token),
        user = new { user.Id, user.Username, user.FullName, role = user.RoleName, user.WarehouseId }
    });
});

//Products
app.MapGet("/api/products", (WarehouseDbContext context)=>{
    return context.Products.ToList();
}).RequireAuthorization();

app.MapGet("/api/products/{id}", (int id, WarehouseDbContext context) =>
{
return context.Products.FirstOrDefault(x => x.Id == id);

}).RequireAuthorization();

app.MapPost("/api/products", (CreateProductRequest request,WarehouseDbContext context) =>
{
    var product = new Product
    {
        Sku = request.Sku,
        Name = request.Name,
        CategoryId = request.CategoryId,
        Unit = request.Unit,
        Barcode = request.Barcode,
        MinStockLevel = request.MinStockLevel,
        Price = request.Price,
        IsActive = request.IsActive
    };

    context.Products.Add(product);
    context.SaveChanges();

    return Results.Created($"/api/products/{product.Id}", product);
}).RequireAuthorization();

app.MapPatch("/api/products/{id}", (int id, UpdateProductRequest request, WarehouseDbContext context) =>
{
    
    var product = context.Products.Find(id);
    if (product is null) return Results.NotFound();

    if (request.Name is not null) product.Name = request.Name;
    if (request.Price is not null) product.Price = request.Price.Value;
    if (request.MinStockLevel is not null) product.MinStockLevel = request.MinStockLevel.Value;
    if (request.IsActive is not null) product.IsActive = request.IsActive.Value;

    context.SaveChanges();
    return Results.Ok(product);
}).RequireAuthorization();

app.MapDelete( "/api/products/{id}" ,(int id,WarehouseDbContext context)=>{

    context.Products.RemoveRange(context.Products.Where(x => x.Id == id));
    context.SaveChanges();
    return Results.NoContent();
}).RequireAuthorization();

//Reference
app.MapGet("/api/roles", (WarehouseDbContext context) =>
{
 return(context.Roles.ToList());
}).RequireAuthorization();

app.MapGet("/api/counterparty-types", (WarehouseDbContext context) =>
{
return(context.CounterpartyTypes.ToList());
}).RequireAuthorization();

app.MapGet("/api/document-types", (WarehouseDbContext context) =>
{
    return(context.DocumentTypes.ToList());
}).RequireAuthorization();

app.MapGet("/api/categories", (WarehouseDbContext context) =>
{
    return (context.Categories.ToList());
}).RequireAuthorization();

app.MapPost("/api/categories", (CreateCategoryRequest request, WarehouseDbContext context) =>
{
    var сategory = new Category
    {
        Name = request.Name
    };
    context.Categories.Add(сategory);
    context.SaveChanges();
    return Results.Created($"/api/categories/{сategory.Id}", сategory);
}).RequireAuthorization();

app.MapPatch("/api/categories/{id}", (int id, UpdateCategoryRequest request, WarehouseDbContext context) =>
{
var category = context.Categories.Find(id);
if(category is null) return Results.NotFound();
if(request.Name is not null) category.Name=request.Name;
context.SaveChanges();
return Results.Ok(category);
}).RequireAuthorization();

app.MapDelete("/api/categories/{id}", (int id, WarehouseDbContext context) =>
{
    context.Categories.RemoveRange(context.Categories.Where(x => x.Id == id));
    context.SaveChanges();
    return Results.NoContent();
}).RequireAuthorization();

//Warehouses and Stock

app.MapGet("/api/warehouses", (WarehouseDbContext context) =>
{
    return context.Warehouses.ToList();
}).RequireAuthorization();

app.MapPost("/api/warehouses", (CreateWarehouseRequest request, WarehouseDbContext context) =>
{
    var warehouse = new Warehouse
    {
        Name = request.Name,
        Address= request.Address
    };
    context.Warehouses.Add(warehouse);
    context.SaveChanges();
    return Results.Created($"/api/warehouses/{warehouse.Id}", warehouse);
}).RequireAuthorization();
app.MapPatch("/api/warehouses/{id}", (int id, UpdateWarehouseRequest request, WarehouseDbContext context) =>
{
    var warehouse = context.Warehouses.Find(id);
    if(warehouse is null) return Results.NotFound();
    if(request.Name is not null) warehouse.Name=request.Name;
    if(request.Address is not null) warehouse.Address=request.Address;
    context.SaveChanges();
    return Results.Ok(warehouse);
}).RequireAuthorization();

app.MapDelete("/api/warehouses/{id}", (int id, WarehouseDbContext context) =>
{
    context.Warehouses.RemoveRange(context.Warehouses.Where(x => x.Id == id));
    context.SaveChanges();
    return Results.NoContent();

}).RequireAuthorization();

app.MapGet("/api/stock", (int? warehouseId, int? productId, bool? belowMinStock, WarehouseDbContext context) =>
{
    var query = context.Stocks
        .Include(s => s.Product)
        .Include(s => s.Warehouse)
        .AsQueryable();

    if (warehouseId is not null)
        query = query.Where(s => s.WarehouseId == warehouseId);

    if (productId is not null)
        query = query.Where(s => s.ProductId == productId);

    if (belowMinStock == true)
        query = query.Where(s => s.Quantity < s.Product.MinStockLevel);

    var result = query.Select(s => new
    {
        s.ProductId,
        ProductSku = s.Product.Sku,
        ProductName = s.Product.Name,
        s.WarehouseId,
        WarehouseName = s.Warehouse.Name,
        s.Quantity,
        MinStockLevel = s.Product.MinStockLevel
    });

    return result.ToList();
}).RequireAuthorization();

//Counterparties
app.MapGet("/api/counterparties", (int? typeid,WarehouseDbContext context) =>
{

    var query = context.Counterparties.AsQueryable();
    if (typeid is not null)
    {
        query = query.Where(u => u.TypeId == typeid).AsQueryable();
    }

    var result = query.Select(s => new
        {
            s.Id,
            s.Name,
            s.Address,
            s.TypeId,
            s.Email,
            s.Phone
        }
    );
    return result.ToList();
}).RequireAuthorization();

app.MapGet("/api/counterparties/{id}", (int? id, WarehouseDbContext context) =>
{
    var counterparty = context.Counterparties.Find(id);
    if (counterparty is null) return Results.NotFound();
    return Results.Ok(counterparty);
}).RequireAuthorization();

app.MapPost("/api/counterparties", (CreateCounterpartiesRequest request, WarehouseDbContext context) =>
{
    Counterparty counterparty = new Counterparty()
    {
        TypeId = request.TypeId,
        Name = request.Name,
        Email = request.Email,
        Phone = request.Phone,
        Address = request.Address
    };
    context.Counterparties.Add(counterparty);
    context.SaveChanges();
    return Results.Created($"/api/counterparties/{counterparty.Id}", counterparty);
}).RequireAuthorization();
app.MapPatch("/api/counterparties/{id}", (int id, UpdateCounetrpartiesRequest request, WarehouseDbContext context) =>
{
    Counterparty counterparty = context.Counterparties.Find(id);
    if(counterparty is null) return Results.NotFound();
    if (request.Name is not null) counterparty.Name = request.Name;
    if(request.Email is not null) counterparty.Email = request.Email;
    if(request.Phone is not null) counterparty.Phone = request.Phone;
    if(request.Address is not null) counterparty.Address = request.Address;
    context.SaveChanges();
    return Results.Ok(counterparty);
}).RequireAuthorization();

app.MapDelete("/api/counterparties/{id}", (int id, WarehouseDbContext context) =>
{
    context.Counterparties.RemoveRange(context.Counterparties.Where(x => x.Id == id));
    context.SaveChanges();
    return Results.Ok();
}).RequireAuthorization();
app.Run();
