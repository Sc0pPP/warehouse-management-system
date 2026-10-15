namespace WarehouseApi.DTO;

public record ChangePasswordRequest(
    string NewPassword,
    string CurrentPassword
    );