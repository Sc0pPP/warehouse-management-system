namespace WarehouseApi.DTO;

public record CreateProductRequest(
    string Sku,
    string Name,
    int CategoryId,
    string Unit,
    string? Barcode,
    decimal MinStockLevel,
    decimal Price,
    bool IsActive
    );