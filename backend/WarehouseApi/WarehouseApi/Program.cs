using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
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

// --- Изоляция по складам ---
// У Директора/сотрудника в токене есть claim "warehouseId" — их всегда
// принудительно скопим на этот склад, игнорируя то, что прислал клиент
// (иначе сотрудник склада 1 мог бы подставить warehouseId склада 2 и
// украсть/испортить чужие данные). У Админа claim'а нет вообще — он должен
// явно указать warehouseId параметром запроса, иначе непонятно, с каким
// складом он работает.
static (int? warehouseId, IResult? error) ResolveWarehouseId(ClaimsPrincipal user, int? requestedWarehouseId)
{
    if (user.IsInRole("Админ"))
    {
        return requestedWarehouseId is null
            ? (null, Results.BadRequest("Укажите warehouseId (вы — Админ, у вас нет своего склада)."))
            : (requestedWarehouseId, null);
    }

    var claim = user.FindFirst("warehouseId");
    return claim is null
        ? (null, Results.Forbid())
        : (int.Parse(claim.Value), null);
}

//Products
app.MapGet("/api/products", (int? warehouseId, ClaimsPrincipal user, WarehouseDbContext context) =>
{
    var (whId, error) = ResolveWarehouseId(user, warehouseId);
    if (error is not null) return error;

    return Results.Ok(context.Products.Where(p => p.WarehouseId == whId).ToList());
}).RequireAuthorization();

app.MapGet("/api/products/{id}", (int id, int? warehouseId, ClaimsPrincipal user, WarehouseDbContext context) =>
{
    var (whId, error) = ResolveWarehouseId(user, warehouseId);
    if (error is not null) return error;

    var product = context.Products.FirstOrDefault(x => x.Id == id && x.WarehouseId == whId);
    return product is null ? Results.NotFound() : Results.Ok(product);
}).RequireAuthorization();

app.MapPost("/api/products", (CreateProductRequest request, ClaimsPrincipal user, WarehouseDbContext context) =>
{
    var (whId, error) = ResolveWarehouseId(user, request.WarehouseId);
    if (error is not null) return error;

    var product = new Product
    {
        WarehouseId = whId!.Value,
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

app.MapPatch("/api/products/{id}", (int id, int? warehouseId, UpdateProductRequest request, ClaimsPrincipal user, WarehouseDbContext context) =>
{
    var (whId, error) = ResolveWarehouseId(user, warehouseId);
    if (error is not null) return error;

    var product = context.Products.FirstOrDefault(x => x.Id == id && x.WarehouseId == whId);
    if (product is null) return Results.NotFound();

    if (request.Name is not null) product.Name = request.Name;
    if (request.Price is not null) product.Price = request.Price.Value;
    if (request.MinStockLevel is not null) product.MinStockLevel = request.MinStockLevel.Value;
    if (request.IsActive is not null) product.IsActive = request.IsActive.Value;

    context.SaveChanges();
    return Results.Ok(product);
}).RequireAuthorization();

app.MapDelete("/api/products/{id}", (int id, int? warehouseId, ClaimsPrincipal user, WarehouseDbContext context) =>
{
    var (whId, error) = ResolveWarehouseId(user, warehouseId);
    if (error is not null) return error;

    context.Products.RemoveRange(context.Products.Where(x => x.Id == id && x.WarehouseId == whId));
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

app.MapGet("/api/categories", (int? warehouseId, ClaimsPrincipal user, WarehouseDbContext context) =>
{
    var (whId, error) = ResolveWarehouseId(user, warehouseId);
    if (error is not null) return error;

    return Results.Ok(context.Categories.Where(c => c.WarehouseId == whId).ToList());
}).RequireAuthorization();

app.MapPost("/api/categories", (CreateCategoryRequest request, ClaimsPrincipal user, WarehouseDbContext context) =>
{
    var (whId, error) = ResolveWarehouseId(user, request.WarehouseId);
    if (error is not null) return error;

    var category = new Category
    {
        WarehouseId = whId!.Value,
        Name = request.Name
    };
    context.Categories.Add(category);
    context.SaveChanges();
    return Results.Created($"/api/categories/{category.Id}", category);
}).RequireAuthorization();

app.MapPatch("/api/categories/{id}", (int id, int? warehouseId, UpdateCategoryRequest request, ClaimsPrincipal user, WarehouseDbContext context) =>
{
    var (whId, error) = ResolveWarehouseId(user, warehouseId);
    if (error is not null) return error;

    var category = context.Categories.FirstOrDefault(x => x.Id == id && x.WarehouseId == whId);
    if (category is null) return Results.NotFound();
    if (request.Name is not null) category.Name = request.Name;
    context.SaveChanges();
    return Results.Ok(category);
}).RequireAuthorization();

app.MapDelete("/api/categories/{id}", (int id, int? warehouseId, ClaimsPrincipal user, WarehouseDbContext context) =>
{
    var (whId, error) = ResolveWarehouseId(user, warehouseId);
    if (error is not null) return error;

    context.Categories.RemoveRange(context.Categories.Where(x => x.Id == id && x.WarehouseId == whId));
    context.SaveChanges();
    return Results.NoContent();
}).RequireAuthorization();

//Warehouses — управляют только Админ (сами склады, а не их содержимое)
app.MapGet("/api/warehouses", (WarehouseDbContext context) =>
{
    return context.Warehouses.ToList();
}).RequireAuthorization(policy => policy.RequireRole("Админ"));

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
}).RequireAuthorization(policy => policy.RequireRole("Админ"));
app.MapPatch("/api/warehouses/{id}", (int id, UpdateWarehouseRequest request, WarehouseDbContext context) =>
{
    var warehouse = context.Warehouses.Find(id);
    if(warehouse is null) return Results.NotFound();
    if(request.Name is not null) warehouse.Name=request.Name;
    if(request.Address is not null) warehouse.Address=request.Address;
    context.SaveChanges();
    return Results.Ok(warehouse);
}).RequireAuthorization(policy => policy.RequireRole("Админ"));

app.MapDelete("/api/warehouses/{id}", (int id, WarehouseDbContext context) =>
{
    context.Warehouses.RemoveRange(context.Warehouses.Where(x => x.Id == id));
    context.SaveChanges();
    return Results.NoContent();

}).RequireAuthorization(policy => policy.RequireRole("Админ"));

//Stock — только просмотр остатков своего склада (изменения остатков будут через документы)
app.MapGet("/api/stock", (int? warehouseId, int? productId, bool? belowMinStock, ClaimsPrincipal user, WarehouseDbContext context) =>
{
    var (whId, error) = ResolveWarehouseId(user, warehouseId);
    if (error is not null) return error;

    var query = context.Stocks
        .Include(s => s.Product)
        .Include(s => s.Warehouse)
        .Where(s => s.WarehouseId == whId)
        .AsQueryable();

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

    return Results.Ok(result.ToList());
}).RequireAuthorization();

//Counterparties
app.MapGet("/api/counterparties", (int? typeid, int? warehouseId, ClaimsPrincipal user, WarehouseDbContext context) =>
{
    var (whId, error) = ResolveWarehouseId(user, warehouseId);
    if (error is not null) return error;

    var query = context.Counterparties.Where(c => c.WarehouseId == whId).AsQueryable();
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
    return Results.Ok(result.ToList());
}).RequireAuthorization();

app.MapGet("/api/counterparties/{id}", (int id, int? warehouseId, ClaimsPrincipal user, WarehouseDbContext context) =>
{
    var (whId, error) = ResolveWarehouseId(user, warehouseId);
    if (error is not null) return error;

    var counterparty = context.Counterparties.FirstOrDefault(x => x.Id == id && x.WarehouseId == whId);
    return counterparty is null ? Results.NotFound() : Results.Ok(counterparty);
}).RequireAuthorization();

app.MapPost("/api/counterparties", (CreateCounterpartiesRequest request, ClaimsPrincipal user, WarehouseDbContext context) =>
{
    var (whId, error) = ResolveWarehouseId(user, request.WarehouseId);
    if (error is not null) return error;

    Counterparty counterparty = new Counterparty()
    {
        WarehouseId = whId!.Value,
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
app.MapPatch("/api/counterparties/{id}", (int id, int? warehouseId, UpdateCounetrpartiesRequest request, ClaimsPrincipal user, WarehouseDbContext context) =>
{
    var (whId, error) = ResolveWarehouseId(user, warehouseId);
    if (error is not null) return error;

    var counterparty = context.Counterparties.FirstOrDefault(x => x.Id == id && x.WarehouseId == whId);
    if (counterparty is null) return Results.NotFound();
    if (request.Name is not null) counterparty.Name = request.Name;
    if (request.Email is not null) counterparty.Email = request.Email;
    if (request.Phone is not null) counterparty.Phone = request.Phone;
    if (request.Address is not null) counterparty.Address = request.Address;
    context.SaveChanges();
    return Results.Ok(counterparty);
}).RequireAuthorization();

app.MapDelete("/api/counterparties/{id}", (int id, int? warehouseId, ClaimsPrincipal user, WarehouseDbContext context) =>
{
    var (whId, error) = ResolveWarehouseId(user, warehouseId);
    if (error is not null) return error;

    context.Counterparties.RemoveRange(context.Counterparties.Where(x => x.Id == id && x.WarehouseId == whId));
    context.SaveChanges();
    return Results.NoContent();
}).RequireAuthorization();
app.Run();
