using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace WarehouseApi.Models;

public partial class DocumentNumberCounter
{
    public int WarehouseId { get; set; }

    public int TypeId { get; set; }

    public int LastNumber { get; set; }

    [JsonIgnore]
    public virtual DocumentType Type { get; set; } = null!;

    [JsonIgnore]
    public virtual Warehouse Warehouse { get; set; } = null!;
}
