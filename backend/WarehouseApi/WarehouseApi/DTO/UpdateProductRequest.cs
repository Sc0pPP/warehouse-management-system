namespace WarehouseApi.DTO;

// Все поля nullable: null значит "это поле не трогаем", а не "запиши в него null".
public record UpdateProductRequest(
    string? Name,
    decimal? MinStockLevel,
    decimal? Price,
    bool? IsActive
    );
