namespace WarehouseApi.DTO;

public record CreateCounterpartiesRequest(
    int TypeId,
    string Name,
    string Phone,
    string Email,
    string Address,
    int? WarehouseId = null
    );