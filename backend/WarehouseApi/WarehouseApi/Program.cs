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
        IsActive = true
    };

    context.Products.Add(product);
    context.SaveChanges();

    return Results.Created($"/api/products/{product.Id}", product);
});

app.MapPatch($"/api/products", (int id, UpdateProductRequest request, WarehouseDbContext context) =>
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
    return Results.NoContent();
});

app.Run();
