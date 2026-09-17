using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace WarehouseApi.Models;

public partial class Warehouse
{
    [JsonIgnore]
    public int Id { get; set; }

    public string Name { get; set; } = null!;

    public string? Address { get; set; }

    [JsonIgnore]
    public virtual ICollection<Document> DocumentTargetWarehouses { get; set; } = new List<Document>();

    [JsonIgnore]
    public virtual ICollection<Document> DocumentWarehouses { get; set; } = new List<Document>();

    [JsonIgnore]
    public virtual ICollection<Stock> Stocks { get; set; } = new List<Stock>();
}
