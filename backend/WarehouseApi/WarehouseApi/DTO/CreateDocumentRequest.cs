namespace WarehouseApi.DTO;

public record CreateDocumentItemRequest(int ProductId, decimal Quantity, decimal? Price);

public record CreateDocumentRequest(
    int TypeId,
    string Number,
    int? CounterpartyId,
    string? Comment,
    List<CreateDocumentItemRequest> Items
);