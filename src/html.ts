'use strict';

import * as vscode from 'vscode';

var fs = require('fs');
var Convert = require('ansi-to-html');
var convert = new Convert();


export class HtmlView implements vscode.TextDocumentContentProvider {

    public static getInstance() : HtmlView {
        return provider;
    }

    public provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken) : vscode.ProviderResult<string> {
        // TODO: detect failure to load page (e.g. google.com) and display error to user.
        if (uri.toString() != 'http://internal') {
            return "<iframe src=\"" + uri + "\" frameBorder=\"0\" width=\"1024\" height=\"1024\"/>";
        } else {
            return this.m_internalHtml;
        }
    };


	public onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();

	get onDidChange(): vscode.Event<vscode.Uri> { return this.onDidChangeEmitter.event; }

    private m_internalHtml = "";



    public preview(html: string, title: string) {
        this.m_internalHtml = html; 
        vscode.commands.executeCommand('vscode.previewHtml', 'http://internal', 1, title);

        this.onDidChangeEmitter.fire(vscode.Uri.parse('http://internal')); 
    }

    public setExtensionPath(path: string) {
        this.m_ExtensionPath = path;
    }

    public createPreviewFromText(text: string, title: string) {

        text = text.replace(/(\r\n|\n|\r)/gm,"<br/>");

        this.documentStart(title);
        this.documentParagraph(text);
        this.documentEnd();

        this.preview(this.m_CurrentDocument, title);
    }

    public createPreviewFromObject(o : object) {

        this.documentStart(o['title']);

        this.documentTableStart(o['headers']);

        var onRowClick: any[] = undefined;

        // check if we have onclick pattern
        if (o.hasOwnProperty('onrowclick')) {
            onRowClick = o['onrowclick'];
        }

        for (var i: number = 0; i < o['rows'].length; i++) {
            var link = '';           
            // prepare onclick for this row here
            if (onRowClick) {
                var command = onRowClick[0];
                var params = [];

                for (var x: number = 1; x < onRowClick.length; x++) {
                    if (onRowClick[x][0] == '$') {
                        // XXX try to get value
                        var field: string = onRowClick[x].substring(1);
                        var value: string = o['rows'][i][field];

                        params.push(value);
                    } else {
                        params.push(def[x]);
                    }
                }
                var link: string = encodeURI(command + '?' + JSON.stringify(params));
            }

            this.documentTableRowStart(i, link);

            for (var j: number = 0; j < o['headers'].length; j++) {

                if (typeof o['headers'][j] == 'string') {
                    this.documentTableCell(o['rows'][i][o['headers'][j]]);
                } else {
                    var def = o['headers'][j];
                    var command = def[1];
                    var params = [];

                    for (var x: number = 2; x < def.length; x++) {
                        if (def[x][0] == '$') {
                            // XXX try to get value
                            var field: string = def[x].substring(1);
                            var value: string = o['rows'][i][field];

                            params.push(value);
                        } else {
                            params.push(def[x]);
                        }
                    }

                    // generate link
                    var link: string = encodeURI(command + '?' + JSON.stringify(params));

                    this.documentTableCellLink(def[0], link);
                } 
            }

            this.documentTableRowEnd();
        }

        this.documentTableEnd();

        

        this.documentEnd();

        this.preview(this.m_CurrentDocument, o['title']);
    }

    private m_CurrentDocument = '';
    private m_GlobalLinks = '';
    private m_ExtensionPath = '';

    private documentStart(title: string) {
        this.m_GlobalLinks = '';
        this.m_CurrentDocument = '';
        var css = fs.readFileSync(this.m_ExtensionPath + '/css.txt')
        var script = fs.readFileSync(this.m_ExtensionPath + '/script.js')

        this.write('<!DOCTYPE "html">');
        this.write("<html>");
        this.write("<head>");
        this.write("<title>" + title + "</title>");
        this.write("</head>");
        this.write(css);
        this.write('<script>' + script + '</script>');
        this.write("<body>");

        this.write('<p id="dupa">KUPA</p>');
   }

    private documentEnd() {
        this.write(this.m_GlobalLinks);
        this.write("</body>");
        this.write("</html>");
    }

    private documentParagraph(text: string) {
        this.write('<p>' + text + '</p>');
    }

    private tabIndex = 1;

    private documentTableStart(headers) {
        this.write("<table cellspacing='0' tabindex='1' onkeypress='tableKey(event)' onkeydown='tableKeyDown(event)'>");

        this.documentTableRowStart(-1, '');

        for (var i in headers) {
            if (typeof headers[i] == 'string') {
                this.write('<th>' + headers[i] + '</th>');
            } else {
                this.write('<th>*</th>');
            }
        }

        this.documentTableRowEnd();
    }

    private documentTableEnd() {
        this.write('</table>');
    }


    private documentTableRowStart(idx, link) {

        if (idx >= 0) {
            this.write('<tr id="tr_' + idx + '" tabindex="' + this.tabIndex++ + '" onclick="tableRowClick(event);" onfocus="tableRowFocus(event)">');
        } else {
            this.write('<tr>');
        }

        this.m_GlobalLinks += "<a href='" + link + "' id='tr_" + idx + "_a' /></a>";
    }

    private documentTableRowEnd() {
        this.write('</tr>');
    }

    private documentTableCell(text) {
        this.write('<td>' + convert.toHtml(text) + '</td>');
    }

    private documentTableCellLink(text, link) {
        this.write('<td>');
        this.documentWriteLink(text, link);
        this.write('</td>');
    }

    private documentTableButton(text, url) {
        var js = 'window.location.href="' + url + '"';

        this.write("<td><button onclick='" + js + "'>" + text + "</button></td>");
    }

    private documentButtonJs(text, js) {
        this.write("<button onclick='" + js + "'>" + text + "</button>");
    }

    private documentWriteLink(text, link) {
        this.write("<a href='" + link + "'>" + text + "</a>");
    }

    private write(s: string) {
        this.m_CurrentDocument += s;
    }
}

var provider = new HtmlView();
// Handle http:// and https://.
var registrationHTTPS = vscode.workspace.registerTextDocumentContentProvider('https', provider);
var registrationHTTP = vscode.workspace.registerTextDocumentContentProvider('http', provider);

