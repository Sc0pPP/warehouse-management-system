using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace WarehouseApi.Models;

public partial class Counterparty
{
    [JsonIgnore]
    public int Id { get; set; }

    public int TypeId { get; set; }

    public string Name { get; set; } = null!;

    public string? Phone { get; set; }

    public string? Email { get; set; }

    public string? Address { get; set; }

    [JsonIgnore]
    public virtual ICollection<Document> Documents { get; set; } = new List<Document>();

    [JsonIgnore]
    public virtual CounterpartyType Type { get; set; } = null!;
}
