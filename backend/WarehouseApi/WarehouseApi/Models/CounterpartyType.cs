using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace WarehouseApi.Models;

public partial class CounterpartyType
{
    [JsonIgnore]
    public int Id { get; set; }

    public string Name { get; set; } = null!;

    [JsonIgnore]
    public virtual ICollection<Counterparty> Counterparties { get; set; } = new List<Counterparty>();
}
