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

app.MapGet("/api/products/{id}", (int id, WarehouseDbContext? context) =>
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

app.MapPut()


app.Run();
