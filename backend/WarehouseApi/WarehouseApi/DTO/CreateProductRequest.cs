namespace WarehouseApi.DTO;

// WarehouseId нужен только Админу (у него нет своего склада в токене) —
// у Директора/сотрудника он игнорируется, склад берётся из JWT.
public record CreateProductRequest(
    string Sku,
    string Name,
    int CategoryId,
    string Unit,
    string? Barcode,
    decimal MinStockLevel,
    decimal Price,
    bool IsActive,
    int? WarehouseId = null
    );