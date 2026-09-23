namespace WarehouseApi.DTO;

public record CreateUserRequest(
    string UserName,
    string Password,
    string FullName,
    int RoleId,
    int WarehouseId,
    bool IsActive
    );