using ClosedXML.Excel;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;

namespace WarehouseApi.Endpoints;

// ВРЕМЕННЫЙ тест для фазы 0 плана: проверить, скачивается ли файл из
// приложения внутри WebView.Avalonia. Настоящий экспорт (фаза 5) будет
// другим кодом — этот файл потом удаляется целиком вместе с вызовом
// app.MapTestExport() в Program.cs.
public static class TestExportEndpoints
{
    private const string XlsxType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    private const string DocxType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    public static void MapTestExport(this WebApplication app)
    {
        // Только при запуске в Development (launchSettings.json его и ставит):
        // в обычной сборке этих адресов нет вообще.
        if (!app.Environment.IsDevelopment()) return;

        // 1) С авторизацией — как будет в настоящем экспорте. JWT лежит в
        //    заголовке Authorization, поэтому обычной ссылкой (<a href>) этот
        //    адрес не открыть: фронт качает его через fetch и превращает ответ
        //    в blob.
        app.MapGet("/api/test/export", (string? format) => BuildFile(format)).RequireAuthorization();

        // 2) Без авторизации — только чтобы проверить второй способ: клик по
        //    обычной ссылке, когда браузер сам обрабатывает заголовок
        //    Content-Disposition: attachment. Файл содержит выдуманные данные.
        app.MapGet("/api/test/export-public", (string? format) => BuildFile(format));
    }

    private static IResult BuildFile(string? format) =>
        format?.ToLowerInvariant() switch
        {
            // Имя файла с кириллицей и пробелом — нарочно: заодно проверяем,
            // что оно доезжает до диалога сохранения (ASP.NET кладёт его в
            // заголовок в виде filename*=UTF-8''...).
            null or "xlsx" => Results.File(BuildXlsx(), XlsxType, "Тест экспорта.xlsx"),
            "docx" => Results.File(BuildDocx(), DocxType, "Тест экспорта.docx"),
            _ => Results.BadRequest("Параметр format: xlsx или docx")
        };

    private static byte[] BuildXlsx()
    {
        using var workbook = new XLWorkbook();
        var sheet = workbook.Worksheets.Add("Тест экспорта");

        string[] headers = ["SKU", "Наименование", "Остаток", "Цена", "Создан"];
        for (var i = 0; i < headers.Length; i++)
            sheet.Cell(1, i + 1).Value = headers[i];

        (string Sku, string Name, decimal Qty, decimal Price, DateTime Created)[] rows =
        [
            ("SKU-100428", "Короб гофрокартон 400×300", 1416, 45.00m, new DateTime(2026, 9, 23)),
            ("SKU-204117", "Плёнка стрейч 17 мкм", 30, 320.00m, new DateTime(2026, 9, 23)),
            ("SKU-330800", "Паллета EUR 1200×800", 196, 850.00m, new DateTime(2026, 9, 29)),
            ("SKU-644219", "Стеллажный контейнер 60 л", 0, 890.00m, new DateTime(2026, 9, 30)),
        ];
        for (var r = 0; r < rows.Length; r++)
        {
            // Числа и даты кладём как числа и даты, а не строки — иначе в
            // Excel по ним не получится ни сортировать, ни суммировать.
            sheet.Cell(r + 2, 1).Value = rows[r].Sku;
            sheet.Cell(r + 2, 2).Value = rows[r].Name;
            sheet.Cell(r + 2, 3).Value = rows[r].Qty;
            sheet.Cell(r + 2, 4).Value = rows[r].Price;
            sheet.Cell(r + 2, 5).Value = rows[r].Created;
        }

        var last = rows.Length + 1;
        sheet.Range(2, 3, last, 3).Style.NumberFormat.Format = "#,##0.###";
        sheet.Range(2, 4, last, 4).Style.NumberFormat.Format = "#,##0.00";
        sheet.Range(2, 5, last, 5).Style.NumberFormat.Format = "dd.MM.yyyy";

        var header = sheet.Range(1, 1, 1, headers.Length);
        header.Style.Font.Bold = true;
        header.Style.Fill.BackgroundColor = XLColor.FromHtml("#D6EBFF");
        sheet.Range(1, 1, last, headers.Length).SetAutoFilter();
        sheet.SheetView.FreezeRows(1);
        sheet.Columns().AdjustToContents();

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
    }

    private static byte[] BuildDocx()
    {
        using var stream = new MemoryStream();
        // Документ обязательно закрыть (using-блок) ДО stream.ToArray():
        // содержимое дописывается в поток только при закрытии.
        using (var doc = WordprocessingDocument.Create(stream, WordprocessingDocumentType.Document, true))
        {
            var main = doc.AddMainDocumentPart();
            main.Document = new Document(new Body());
            var body = main.Document.Body!;

            body.Append(new Paragraph(
                new ParagraphProperties(new Justification { Val = JustificationValues.Center }),
                new Run(new RunProperties(new Bold(), new FontSize { Val = "32" }), new Text("Тест экспорта"))));
            body.Append(new Paragraph(new Run(new Text($"Сформировано: {DateTime.Now:dd.MM.yyyy HH:mm}"))));

            var table = new Table(new TableProperties(
                new TableWidth { Width = "5000", Type = TableWidthUnitValues.Pct },
                new TableBorders(
                    new TopBorder { Val = BorderValues.Single, Size = 4 },
                    new BottomBorder { Val = BorderValues.Single, Size = 4 },
                    new LeftBorder { Val = BorderValues.Single, Size = 4 },
                    new RightBorder { Val = BorderValues.Single, Size = 4 },
                    new InsideHorizontalBorder { Val = BorderValues.Single, Size = 4 },
                    new InsideVerticalBorder { Val = BorderValues.Single, Size = 4 })));

            table.Append(Row(true, "SKU", "Наименование", "Остаток"));
            table.Append(Row(false, "SKU-100428", "Короб гофрокартон 400×300", "1 416 шт"));
            table.Append(Row(false, "SKU-204117", "Плёнка стрейч 17 мкм", "30 рул"));
            table.Append(Row(false, "SKU-644219", "Стеллажный контейнер 60 л", "0 шт"));
            body.Append(table);
        }
        return stream.ToArray();
    }

    private static TableRow Row(bool bold, params string[] cells)
    {
        var row = new TableRow();
        foreach (var text in cells)
        {
            var run = bold
                ? new Run(new RunProperties(new Bold()), new Text(text))
                : new Run(new Text(text));
            row.Append(new TableCell(new Paragraph(run)));
        }
        return row;
    }
}
