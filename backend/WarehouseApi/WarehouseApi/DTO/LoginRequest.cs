namespace WarehouseApi.DTO;

// CaptchaId/CaptchaAnswer — пара из GET /api/auth/captcha: идентификатор
// выданной капчи и то, что ввёл пользователь.
public record LoginRequest(
    string Username,
    string Password,
    string? CaptchaId = null,
    string? CaptchaAnswer = null
    );
