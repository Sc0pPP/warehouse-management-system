using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace WarehouseApi.Models;

public partial class DocumentItem
{
    public int Id { get; set; }

    public int DocumentId { get; set; }

    public int ProductId { get; set; }

    public decimal Quantity { get; set; }

    public decimal? Price { get; set; }

    [JsonIgnore]
    public virtual Document Document { get; set; } = null!;

    [JsonIgnore]
    public virtual Product Product { get; set; } = null!;
}
