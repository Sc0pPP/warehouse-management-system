namespace WarehouseApi.DTO;

public record UpdateUserRequest(
    
    string? UserName,
    string? Password,
    string? FullName,
    int? RoleId,
    int? WarehouseId,
    bool? IsActive);