using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace WarehouseApi.Models;

public partial class Document
{
    public int Id { get; set; }

    public int TypeId { get; set; }

    public string Number { get; set; } = null!;

    public int WarehouseId { get; set; }

    public int? TargetWarehouseId { get; set; }

    public int? CounterpartyId { get; set; }

    public int UserId { get; set; }

    public string Status { get; set; } = null!;

    public bool IsPosted { get; set; }

    public DateTime? PostedAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public string? Comment { get; set; }

    [JsonIgnore]
    public virtual Counterparty? Counterparty { get; set; }

    // Не JsonIgnore, в отличие от остальных nav-свойств — это не обратная
    // ссылка на родителя (как Warehouse/User/Type), а полезная нагрузка
    // самого документа. Цикл сериализации не образуется: у DocumentItem
    // обратная ссылка Document как раз JsonIgnore (см. DocumentItem.cs).
    public virtual ICollection<DocumentItem> DocumentItems { get; set; } = new List<DocumentItem>();

    [JsonIgnore]
    public virtual Warehouse? TargetWarehouse { get; set; }

    [JsonIgnore]
    public virtual DocumentType Type { get; set; } = null!;

    [JsonIgnore]
    public virtual User User { get; set; } = null!;

    [JsonIgnore]
    public virtual Warehouse Warehouse { get; set; } = null!;
}
