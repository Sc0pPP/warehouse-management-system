using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace WarehouseApi.Models;

public partial class DocumentType
{
    public int Id { get; set; }

    public string Name { get; set; } = null!;

    public string Prefix { get; set; } = null!;

    public int NumberWidth { get; set; }

    public int? CounterpartyTypeId { get; set; }

    public bool HasPrices { get; set; }

    public string StockEffect { get; set; } = null!;

    public int SortOrder { get; set; }

    [JsonIgnore]
    public virtual CounterpartyType? CounterpartyType { get; set; }

    [JsonIgnore]
    public virtual ICollection<DocumentNumberCounter> DocumentNumberCounters { get; set; } = new List<DocumentNumberCounter>();

    [JsonIgnore]
    public virtual ICollection<Document> Documents { get; set; } = new List<Document>();
}
