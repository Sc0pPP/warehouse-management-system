using Microsoft.EntityFrameworkCore;
using WarehouseApi.Data;
using WarehouseApi.DTO;
using WarehouseApi.Models;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddOpenApi();
builder.Services.AddDbContext<WarehouseDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Default")));

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
        policy.WithOrigins("http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod());
});

var app = builder.Build();
app.UseCors("AllowFrontend");


//Products
app.MapGet("/api/products", (WarehouseDbContext context)=>{
    return context.Products.ToList();
});

app.MapGet("/api/products/{id}", (int id, WarehouseDbContext context) =>
{
return context.Products.FirstOrDefault(x => x.Id == id);

});

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
});

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
});

app.MapDelete( "/api/products/{id}" ,(int id,WarehouseDbContext context)=>{

    context.Products.RemoveRange(context.Products.Where(x => x.Id == id));
    context.SaveChanges();  
    return Results.NoContent();
});

//Reference
app.MapGet("/api/roles", (WarehouseDbContext context) =>
{
 return(context.Roles.ToList());
});

app.MapGet("/api/counterparty-types", (WarehouseDbContext context) =>
{
return(context.CounterpartyTypes.ToList());
});

app.MapGet("/api/document-types", (WarehouseDbContext context) =>
{
    return(context.DocumentTypes.ToList());
});

app.MapGet("/api/categories", (WarehouseDbContext context) =>
{
    return (context.Categories.ToList());
});

app.MapPost("/api/categories", (CreateCategoryRequest request, WarehouseDbContext context) =>
{
    var сategory = new Category
    {
        Name = request.Name
    };
    context.Categories.Add(сategory);
    context.SaveChanges();
    return Results.Created($"/api/categories/{сategory.Id}", сategory);
});

app.MapPatch("/api/categories/{id}", (int id, UpdateCategoryRequest request, WarehouseDbContext context) =>
{
var category = context.Categories.Find(id);
if(category is null) return Results.NotFound();
if(request.Name is not null) category.Name=request.Name;
context.SaveChanges();
return Results.Ok(category);
});

app.MapDelete("/api/categories/{id}", (int id, WarehouseDbContext context) =>
{
    context.Categories.RemoveRange(context.Categories.Where(x => x.Id == id));
    context.SaveChanges();
    return Results.NoContent();
});

//Warehouses and Stock

app.MapGet("/api/warehouses", (WarehouseDbContext context) =>
{
    return context.Warehouses.ToList();
});

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
});
app.MapPatch("/api/warehouses/{id}", (int id, UpdateWarehouseRequest request, WarehouseDbContext context) =>
{
    var warehouse = context.Warehouses.Find(id);
    if(warehouse is null) return Results.NotFound();
    if(request.Name is not null) warehouse.Name=request.Name;
    if(request.Address is not null) warehouse.Address=request.Address;
    context.SaveChanges();
    return Results.Ok(warehouse);
});

app.MapDelete("/api/warehouses/{id}", (int id, WarehouseDbContext context) =>
{
    context.Warehouses.RemoveRange(context.Warehouses.Where(x => x.Id == id));
    context.SaveChanges();
    return Results.NoContent();
    
});

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
});

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
});

app.MapGet("/api/counterparties/{id}", (int? id, WarehouseDbContext context) =>
{
    var counterparty = context.Counterparties.Find(id);
    if (counterparty is null) return Results.NotFound();
    return Results.Ok(counterparty);
});

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
});
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
});

app.MapDelete("/api/counterparties/{id}", (int id, WarehouseDbContext context) =>
{
    context.Counterparties.RemoveRange(context.Counterparties.Where(x => x.Id == id));
    context.SaveChanges();
    return Results.Ok();
});
app.Run();
