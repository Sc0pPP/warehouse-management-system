namespace WarehouseApi.DTO;

public record CreateCategoryRequest
(
    string Name,
    int? WarehouseId = null
);