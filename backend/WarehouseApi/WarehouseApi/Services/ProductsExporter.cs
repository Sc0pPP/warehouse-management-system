using ClosedXML.Excel;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Bibliography;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using Microsoft.EntityFrameworkCore;
using WarehouseApi.Data;
using Document = WarehouseApi.Models.Document;

namespace WarehouseApi.Services;

public class ProductsExporter
{
    public const string XlsxType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    public const string DocxType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    public byte[] ToXlsx(Document document)
    {
        
        using var workbook = new XLWorkbook();
        var sheet = workbook.Worksheets.Add(document.Number);
        sheet.Cell(1, 1).Value = "Название";
        sheet.Cell(1, 2).Value = "SKU";
        sheet.Cell(1, 3).Value = "Цена(1 шт.)";
        sheet.Cell(1, 4).Value = "Количество";
        sheet.Cell(1, 5).Value = "Общая стоимость продукта";
        int count = 2;
        sheet.Columns().AdjustToContents(minWidth: 10, maxWidth: 40);
        sheet.Column(1).Style.Alignment.WrapText = true;
        sheet.Column(1).Width = 40;
        sheet.Range(1, 1, 1, 5).Style.Alignment.WrapText = true;
        foreach (var item in document.DocumentItems )
        {
            var price = item.Price ?? 0m; 
            sheet.Cell(count, 1).Value = item.Product.Name;
            sheet.Cell(count, 2).Value = item.Product.Sku;
            sheet.Cell(count, 3).Value = price;
            sheet.Cell(count, 4).Value = item.Quantity;
            sheet.Cell(count, 5).Value = item.Quantity * price;
            count++;
        }
        int last = count - 1;
        sheet.Range(2, 1,last, 5).Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
    }
    
    private static Table ToWordTable(IXLRange range)
    {
        var table = new Table(new TableProperties(
            new TableWidth { Width = "5000", Type = TableWidthUnitValues.Pct },
            new TableBorders(
                new TopBorder { Val = BorderValues.Single, Size = 4 },
                new LeftBorder { Val = BorderValues.Single, Size = 4 },
                new BottomBorder { Val = BorderValues.Single, Size = 4 },
                new RightBorder { Val = BorderValues.Single, Size = 4 },
                new InsideHorizontalBorder { Val = BorderValues.Single, Size = 4 },
                new InsideVerticalBorder { Val = BorderValues.Single, Size = 4 })));
        var grid = new TableGrid();
        for (var i = 0; i < range.ColumnCount(); i++)
            grid.Append(new GridColumn());
        table.Append(grid);
        foreach (var xlRow in range.Rows())
        {
            var row = new TableRow();
            foreach (var cell in xlRow.Cells())
            {
                row.Append(new TableCell(
                    new Paragraph(new Run(new Text(cell.GetFormattedString())))));
            }
            table.Append(row);
        }
        return table;
    }
    
    public byte[] ToDocx(Document document)
    {
        var xlsxBytes = ToXlsx(document);
        using var workbook = new XLWorkbook(new MemoryStream(xlsxBytes));
        var table = workbook.Worksheet(1).RangeUsed();
    
        using var stream = new MemoryStream();
        using (var doc = WordprocessingDocument.Create(stream, WordprocessingDocumentType.Document, true))
        {
            var main = doc.AddMainDocumentPart();
            main.Document = new DocumentFormat.OpenXml.Wordprocessing.Document(new Body());
            var body = main.Document.Body!;

            // 2) Шапка документа абзацами (номер, дата, контрагент, склад)
            body.Append(new Paragraph(new Run(new Text($"Документ № {document.Number}"))));
            body.Append(new Paragraph(new Run(new Text($"Дата {Convert.ToString(DateTime.Now)}"))));
            body.Append(new Paragraph(new Run(new Text($"Контрагент {document.Counterparty.Name}"))));
            body.Append(new Paragraph(new Run(new Text($"Склад {document.Warehouse.Name}"))));
            body.Append(ToWordTable(table));
            // 4) Подписи и всё остальное, чего нет в Excel
            body.Append(new Paragraph(new Run(new Text("Принял: ____________"))));
            body.Append(new Paragraph(new Run(new Text("Контрагент: ____________"))));

        }
        return stream.ToArray();
    }
    
}