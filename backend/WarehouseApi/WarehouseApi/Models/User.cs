using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace WarehouseApi.Models;

public partial class User
{
    public int Id { get; set; }

    public string Username { get; set; } = null!;

    public string PasswordHash { get; set; } = null!;

    public string FullName { get; set; } = null!;

    public int RoleId { get; set; }

    public bool IsActive { get; set; }

    [JsonIgnore]
    public virtual ICollection<Document> Documents { get; set; } = new List<Document>();

    [JsonIgnore]
    public virtual Role Role { get; set; } = null!;
}
