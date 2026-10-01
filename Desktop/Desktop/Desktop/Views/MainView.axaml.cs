using System;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;
using Avalonia.Controls;
using Avalonia.Platform.Storage;
using Avalonia.Threading;

namespace Desktop.Views;

public partial class MainView : UserControl
{
    public MainView()
    {
        InitializeComponent();
        Web.WebMessageReceived += (_, e) => _ = HandleMessageAsync(e.Message);
    }

    private async Task HandleMessageAsync(string? json)
    {
        if (string.IsNullOrEmpty(json)) return;

        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        if (root.GetProperty("type").GetString() != "saveFile") return;

        var fileName = root.GetProperty("fileName").GetString() ?? "file";
        var bytes = Convert.FromBase64String(root.GetProperty("base64").GetString() ?? "");

        // Сообщение приходит не в UI-потоке, а диалог открывается только из него
        await Dispatcher.UIThread.InvokeAsync(async () =>
        {
            var storage = TopLevel.GetTopLevel(this)?.StorageProvider;
            if (storage is null) return;

            var file = await storage.SaveFilePickerAsync(new FilePickerSaveOptions
            {
                SuggestedFileName = fileName,
                DefaultExtension = Path.GetExtension(fileName).TrimStart('.'),
            });
            if (file is null) return; // пользователь нажал «Отмена»

            await using var stream = await file.OpenWriteAsync();
            await stream.WriteAsync(bytes);
        });
    }
}