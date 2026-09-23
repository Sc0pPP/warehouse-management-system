using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace WarehouseApi.Models;

public partial class Warehouse
{
    public int Id { get; set; }

    public string Name { get; set; } = null!;

    public string? Address { get; set; }

    [JsonIgnore]
    public virtual ICollection<Category> Categories { get; set; } = new List<Category>();

    [JsonIgnore]
    public virtual ICollection<Counterparty> Counterparties { get; set; } = new List<Counterparty>();

    [JsonIgnore]
    public virtual ICollection<DocumentItem> DocumentItems { get; set; } = new List<DocumentItem>();

    [JsonIgnore]
    public virtual ICollection<Document> DocumentTargetWarehouses { get; set; } = new List<Document>();

    [JsonIgnore]
    public virtual ICollection<Document> DocumentWarehouses { get; set; } = new List<Document>();

    [JsonIgnore]
    public virtual ICollection<Product> Products { get; set; } = new List<Product>();

    [JsonIgnore]
    public virtual ICollection<Stock> Stocks { get; set; } = new List<Stock>();

    [JsonIgnore]
    public virtual ICollection<User> Users { get; set; } = new List<User>();
}
