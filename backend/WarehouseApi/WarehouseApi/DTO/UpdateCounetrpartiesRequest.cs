namespace WarehouseApi.DTO;

public record UpdateCounetrpartiesRequest(
    string? Name,
    string? Phone,
    string? Email,
    string? Address
    );