using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace WarehouseApi.Models;

public partial class User
{
    public int Id { get; set; }

    public string Username { get; set; } = null!;

    // Хэш пароля никогда не должен попадать в ответ API.
    [JsonIgnore]
    public string PasswordHash { get; set; } = null!;

    public string FullName { get; set; } = null!;

    public int RoleId { get; set; }

    public int? WarehouseId { get; set; }

    public bool IsActive { get; set; }

    public DateTime? LastLoginAt { get; set; }

    public DateTime PasswordChangedAt { get; set; }

    public bool MustChangePassword { get; set; }

    [JsonIgnore]
    public virtual ICollection<Document> Documents { get; set; } = new List<Document>();

    [JsonIgnore]
    public virtual Role Role { get; set; } = null!;

    [JsonIgnore]
    public virtual Warehouse? Warehouse { get; set; }
}
