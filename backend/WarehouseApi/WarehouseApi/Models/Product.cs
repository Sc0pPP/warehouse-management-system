using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace WarehouseApi.Models;

public partial class Product
{
    public int Id { get; set; }

    public string Sku { get; set; } = null!;

    public string Name { get; set; } = null!;

    public int CategoryId { get; set; }

    public string Unit { get; set; } = null!;

    public string? Barcode { get; set; }

    public decimal MinStockLevel { get; set; }

    public decimal Price { get; set; }

    public bool IsActive { get; set; }

    [JsonIgnore]
    public virtual Category Category { get; set; } = null!;

    [JsonIgnore]
    public virtual ICollection<DocumentItem> DocumentItems { get; set; } = new List<DocumentItem>();

    [JsonIgnore]
    public virtual ICollection<Stock> Stocks { get; set; } = new List<Stock>();
}
