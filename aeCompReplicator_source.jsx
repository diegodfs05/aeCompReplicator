/**
 * meuReplicadorDeComp.jsx
 *
 * This version has all UI text and alerts in Portuguese.
 *
 * HOW IT WORKS (English summary):
 *  1) One label row for each prompt (e.g. "Selecione a Composição").
 *  2) Another row for the actual controls (e.g. dropdowns, buttons).
 *  3) Data file format can be JSON or CSV (semicolon-separated).
 *  4) "Número de camadas de texto" determines how many dropdowns to create
 *     for selecting which text layers to update.
 *  5) Replicates the composition for each row in the data file, updating the chosen text layers.
 */

/*******************************************************
 * 0) String.trim polyfill for older ExtendScript
 *******************************************************/
if (typeof String.prototype.trim !== 'function') {
    String.prototype.trim = function() {
        return this.replace(/^\s+|\s+$/g, '');
    };
}

/*******************************************************
 * 1) Minimal JSON polyfill
 *******************************************************/
if (typeof JSON === 'undefined') {
    JSON = {
        parse: function(str) {
            // Using eval(...) for old AE engines; caution if data is untrusted
            return eval('(' + str + ')');
        },
        stringify: function() {
            throw new Error('JSON.stringify não está implementado neste polyfill.');
        }
    };
}

/*******************************************************
 * 2) Array.isArray polyfill
 *******************************************************/
if (typeof Array.isArray === 'undefined') {
    Array.isArray = function(arg) {
        return Object.prototype.toString.call(arg) === '[object Array]';
    };
}

(function(thisObj) {

    var mainPanel;

    // UI references
    var compDropdown,
        reloadBtn,
        formatDropdown,
        jsonLabel,
        browseBtn,
        fieldsCountInput,
        setFieldsBtn,
        fieldsGroup,
        layerSelectors = [],
        processBtn;

    /**
     * buildUI()
     * Creates the dockable/floating panel with a layout where each
     * label is on its own row, and the associated controls are on
     * the next row.
     */
    function buildUI(thisObj) {
        // Create a dockable panel if in AE, otherwise a floating window
        var panel = (thisObj instanceof Panel)
            ? thisObj
            : new Window('palette', 'Replicador de Comps', undefined, {resizeable: true});
        mainPanel = panel;

        // Panel orientation
        panel.orientation = 'column';
        panel.alignChildren = ['fill', 'top'];

        //---------------------------------------------------
        // 1) Selecione a Composição
        //---------------------------------------------------
        // 1A) Label row
        panel.add('statictext', undefined, 'Selecione a Composição:');

        // 1B) Controls row
        var compRow = panel.add('group');
        compRow.orientation = 'row';
        compRow.alignChildren = ['fill', 'center'];
        compRow.alignment = ['fill', 'top'];

        compDropdown = compRow.add('dropdownlist', undefined, []);
        compDropdown.alignment = ['fill', 'center'];

        reloadBtn = compRow.add('button', undefined, 'Recarregar Composições');

        //---------------------------------------------------
        // 2) Formato do Arquivo de Dados
        //---------------------------------------------------
        // 2A) Label row
        panel.add('statictext', undefined, 'Selecione o Formato do Arquivo de Dados:');

        // 2B) Controls row
        var formatRow = panel.add('group');
        formatRow.orientation = 'row';
        formatRow.alignChildren = ['fill', 'center'];
        formatRow.alignment = ['fill', 'top'];

        formatDropdown = formatRow.add('dropdownlist', undefined, ['JSON', 'CSV']);
        formatDropdown.selection = 0; // default JSON
        formatDropdown.alignment = ['fill', 'center'];

        //---------------------------------------------------
        // 3) Selecionar Arquivo
        //---------------------------------------------------
        // 3A) Label row
        panel.add('statictext', undefined, 'Selecione o Arquivo:');

        // 3B) Controls row
        var fileRow = panel.add('group');
        fileRow.orientation = 'row';
        fileRow.alignChildren = ['fill', 'center'];
        fileRow.alignment = ['fill', 'top'];

        jsonLabel = fileRow.add('statictext', undefined, 'Nenhum arquivo selecionado');
        jsonLabel.alignment = ['fill', 'center'];
        // Optionally give it a min width
        jsonLabel.preferredSize.width = 200;

        browseBtn = fileRow.add('button', undefined, 'Procurar Arquivo...');
        browseBtn.alignment = ['right', 'center'];

        //---------------------------------------------------
        // 4) Número de Camadas de Texto
        //---------------------------------------------------
        // 4A) Label row
        panel.add('statictext', undefined, 'Número de camadas de texto a processar:');

        // 4B) Controls row
        var fieldsCountRow = panel.add('group');
        fieldsCountRow.orientation = 'row';
        fieldsCountRow.alignChildren = ['fill', 'center'];
        fieldsCountRow.alignment = ['fill', 'top'];

        fieldsCountInput = fieldsCountRow.add('edittext', undefined, '0');
        fieldsCountInput.characters = 4;
        fieldsCountInput.alignment = ['left', 'center'];

        setFieldsBtn = fieldsCountRow.add('button', undefined, 'Definir Camadas');
        setFieldsBtn.alignment = ['right', 'center'];

        //---------------------------------------------------
        // 5) Group for dynamic text-layer dropdowns
        //---------------------------------------------------
        fieldsGroup = panel.add('group');
        fieldsGroup.orientation = 'column';
        fieldsGroup.alignChildren = ['fill', 'top'];
        fieldsGroup.alignment = ['fill', 'top'];

        //---------------------------------------------------
        // 6) Botão de Replicação
        //---------------------------------------------------
        processBtn = panel.add('button', undefined, 'Replicar Composições');
        processBtn.alignment = ['fill', 'top'];

        //-----------------------------------------------
        // EVENT HANDLERS
        //-----------------------------------------------
        reloadBtn.onClick = function() {
            populateCompList();
        };

        browseBtn.onClick = function() {
            var fileFormat = formatDropdown.selection ? formatDropdown.selection.text : 'JSON';
            var ext = (fileFormat === 'CSV') ? '*.csv' : '*.json';
            var dataFile = File.openDialog('Selecione o arquivo ' + fileFormat, ext);
            if (dataFile && dataFile.exists) {
                jsonLabel.text = decodeURI(dataFile.fsName);
            }
        };

        setFieldsBtn.onClick = function() {
            clearLayerSelectors();
            var count = parseInt(fieldsCountInput.text, 10);
            if (isNaN(count) || count < 1) {
                alert('Por favor, insira um número válido de camadas de texto a processar.');
                return;
            }
            createFieldSelectors(count);
        };

        processBtn.onClick = replicateComps;

        // Attempt to populate comps initially
        populateCompList();

        // Show if floating
        if (panel instanceof Window) {
            panel.center();
            panel.show();
        }

        return panel;
    }


    /**
     * populateCompList()
     * Clears and refills compDropdown with all comps in the project.
     */
    function populateCompList() {
        if (!compDropdown) return;
        compDropdown.removeAll();

        var proj = app.project;
        if (proj && proj.numItems > 0) {
            for (var i = 1; i <= proj.numItems; i++) {
                var item = proj.item(i);
                if (item instanceof CompItem) {
                    compDropdown.add('item', item.name);
                }
            }
            if (compDropdown.items.length > 0) {
                compDropdown.selection = 0;
            }
        }
    }


    /**
     * createFieldSelectors(count)
     * Dynamically creates `count` dropdown selectors, each for picking
     * which text layer to update.
     */
    function createFieldSelectors(count) {
        var selCompName = compDropdown.selection ? compDropdown.selection.text : null;
        if (!selCompName) {
            alert('Nenhuma composição selecionada.');
            return;
        }
        var templateComp = findCompByName(selCompName);
        if (!templateComp) {
            alert('A composição selecionada não foi encontrada no projeto.');
            return;
        }

        // Gather text-layer names
        var textLayerNames = [];
        for (var i = 1; i <= templateComp.numLayers; i++) {
            var lyr = templateComp.layer(i);
            if (lyr.matchName === 'ADBE Text Layer') {
                textLayerNames.push(lyr.name);
            }
        }

        // Create 'count' rows, each with a single dropdown
        for (var k = 0; k < count; k++) {
            var row = fieldsGroup.add('group');
            row.orientation = 'row';
            row.alignChildren = ['fill', 'center'];
            row.alignment = ['fill', 'top'];

            var dd = row.add('dropdownlist', undefined, textLayerNames);
            dd.alignment = ['fill', 'center'];
            if (textLayerNames.length > 0) {
                dd.selection = 0;
            }
            layerSelectors.push(dd);
        }

        // Refresh layout
        fieldsGroup.layout.layout(true);
        mainPanel.layout.layout(true);
    }


    /**
     * clearLayerSelectors()
     * Removes all dynamic drop-downs from fieldsGroup.
     */
    function clearLayerSelectors() {
        while (fieldsGroup.children.length > 0) {
            fieldsGroup.remove(fieldsGroup.children[0]);
        }
        layerSelectors = [];
        fieldsGroup.layout.layout(true);
        mainPanel.layout.layout(true);
    }


    /**
     * replicateComps()
     * Reads the chosen data file, duplicates the template comp for each row,
     * updates the chosen text layers in order, etc.
     */
    function replicateComps() {
        app.beginUndoGroup('Replicar Composições');
        try {
            var proj = app.project;
            if (!proj) {
                alert('Nenhum projeto aberto.');
                return;
            }

            if (!compDropdown.selection) {
                alert('Selecione uma composição primeiro.');
                return;
            }
            var templateCompName = compDropdown.selection.text;
            var templateComp = findCompByName(templateCompName);
            if (!templateComp) {
                alert('A composição selecionada não foi encontrada no projeto.');
                return;
            }

            // Determine file format
            var fileFormat = formatDropdown.selection ? formatDropdown.selection.text : 'JSON';
            var dataPath = jsonLabel.text;
            if (!dataPath || dataPath === 'Nenhum arquivo selecionado') {
                alert('Por favor, selecione um arquivo de dados (' + fileFormat + ').');
                return;
            }
            var dataFile = new File(dataPath);
            if (!dataFile.exists) {
                alert('O arquivo selecionado não existe.');
                return;
            }

            // Parse the file into array of arrays
            dataFile.open('r');
            var content = dataFile.read();
            dataFile.close();
            var rows = parseDataFile(fileFormat, content);
            if (!rows || !Array.isArray(rows) || rows.length === 0) {
                alert('Nenhuma linha válida encontrada no arquivo ' + fileFormat + '.');
                return;
            }

            // If no fields configured, nothing to do
            if (layerSelectors.length === 0) {
                alert('Nenhuma camada de texto foi configurada. Clique em "Definir Camadas" após especificar um número.');
                return;
            }

            // Duplicate the comp for each row
            for (var i = 0; i < rows.length; i++) {
                var rowData = rows[i];
                var newComp = templateComp.duplicate();
                newComp.name = templateComp.name + '_' + (i + 1);

                // For each selected text layer, map from rowData[s]
                for (var s = 0; s < layerSelectors.length; s++) {
                    if (s >= rowData.length) break;

                    var selectedLayerName = layerSelectors[s].selection
                        ? layerSelectors[s].selection.text
                        : null;
                    if (!selectedLayerName) continue;

                    var targetLayer = findLayerByName(newComp, selectedLayerName);
                    if (!targetLayer) continue;

                    var sourceTextProp = targetLayer.property('Source Text');
                    if (sourceTextProp) {
                        var textDoc = sourceTextProp.value;
                        textDoc.text = String(rowData[s]);
                        sourceTextProp.setValue(textDoc);
                    }
                }
            }

            alert('Foram replicadas com sucesso ' + rows.length + ' composições!');
        } catch (e) {
            alert('Erro: ' + e.toString());
        } finally {
            app.endUndoGroup();
        }
    }


    /**
     * parseDataFile(fileFormat, content)
     * Reads 'content' as either JSON or CSV, returning an array of arrays (rows).
     */
    function parseDataFile(fileFormat, content) {
        var rows = [];

        if (fileFormat === 'CSV') {
            // naive semicolon-based CSV
            var lines = content.split('\n');
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i].replace(/\r$/, '').trim();
                if (line === '') { continue; }
                var fields = line.split(';');
                for (var f = 0; f < fields.length; f++) {
                    var field = fields[f].trim().replace(/^"(.*)"$/, '$1');
                    fields[f] = field;
                }
                rows.push(fields);
            }
        } else {
            // JSON
            var data = JSON.parse(content);
            if (!Array.isArray(data)) {
                alert('O arquivo JSON deve conter um array (de objetos ou arrays).');
                return null;
            }
            if (Array.isArray(data[0])) {
                rows = data;
            } else {
                // array of objects => array of arrays
                for (var j = 0; j < data.length; j++) {
                    var obj = data[j];
                    var arr = [];
                    for (var key in obj) {
                        if (obj.hasOwnProperty(key)) {
                            arr.push(obj[key]);
                        }
                    }
                    rows.push(arr);
                }
            }
        }
        return rows;
    }


    /**
     * findCompByName(name)
     * Helper to retrieve a CompItem by name in the project.
     */
    function findCompByName(name) {
        var proj = app.project;
        if (!proj) return null;
        for (var i = 1; i <= proj.numItems; i++) {
            var it = proj.item(i);
            if (it instanceof CompItem && it.name === name) {
                return it;
            }
        }
        return null;
    }


    /**
     * findLayerByName(comp, layerName)
     * Returns the first layer in 'comp' whose name is 'layerName'.
     */
    function findLayerByName(comp, layerName) {
        for (var i = 1; i <= comp.numLayers; i++) {
            var lyr = comp.layer(i);
            if (lyr.name === layerName) {
                return lyr;
            }
        }
        return null;
    }


    // Build the UI
    var myScriptPal = buildUI(thisObj);

    // If inside AE as a dockable panel, refresh layout
    if (myScriptPal instanceof Window === false) {
        myScriptPal.layout.layout(true);
    }

})(this);
