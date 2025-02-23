/**
 * myCompReplicator.jsx
 *
 * Updated script UI panel that:
 *  1) Lets user pick a composition (template).
 *  2) Has a "Reload Comps" button to refresh the list of compositions.
 *  3) Lets user specify how many text layers to process (fieldsCountInput).
 *  4) Dynamically shows that many drop-downs for selecting which text layers in the template comp should be updated.
 *  5) Reads a JSON array, ignoring property names: the 1st property value goes to the 1st selected layer, 2nd to 2nd, etc.
 *  6) Duplicates the comp for each JSON object, updating those text layers with the enumerated property values.
 *
 * Also includes:
 *   - Minimal JSON.parse polyfill using eval() for older AE versions.
 *   - Minimal Array.isArray polyfill.
 */

/*******************************************************
 * 1) Minimal JSON polyfill
 *    Uses eval(...) internally. Use caution with untrusted data.
 *******************************************************/
if (typeof JSON === 'undefined') {
    JSON = {
        parse: function (str) {
            return eval('(' + str + ')');
        },
        stringify: function () {
            throw new Error('JSON.stringify not implemented in this minimal polyfill.');
        }
    };
}

/*******************************************************
 * 2) Array.isArray polyfill
 *******************************************************/
if (typeof Array.isArray === 'undefined') {
    Array.isArray = function (arg) {
        return Object.prototype.toString.call(arg) === '[object Array]';
    };
}

(function (thisObj) {

    var compDropdown,
        reloadBtn,
        fieldsCountInput,
        setFieldsBtn,
        fieldsGroup,
        layerSelectors = [],
        jsonLabel,
        browseBtn,
        processBtn,
        mainPanel;

    /**
     * buildUI()
     * Creates the ScriptUI panel (docked or floating).
     */
    function buildUI(thisObj) {
        // Create a dockable panel if in AE, otherwise a floating window
        var panel = (thisObj instanceof Panel)
            ? thisObj
            : new Window('palette', 'Comp Replicator', undefined, { resizeable: true });

        mainPanel = panel;

        // --- 1) Composition selector row ---
        panel.add('statictext', undefined, 'Selecione uma composição');

        // A row for the dropdown & reload button
        var compRow = panel.add('group');
        compRow.orientation = 'row';
        compDropdown = compRow.add('dropdownlist', undefined, []);

        reloadBtn = compRow.add('button', undefined, 'Recarregar Composições');

        // --- 2) Number of text layers to process ---
        panel.add('statictext', undefined, 'Número de camadas de texto a processar:');
        fieldsCountInput = panel.add('edittext', undefined, '0');
        fieldsCountInput.characters = 4;

        setFieldsBtn = panel.add('button', undefined, 'Definir camadas de texto');

        // --- 3) A group to hold the dynamic text-layer selectors ---
        fieldsGroup = panel.add('group');
        fieldsGroup.orientation = 'column';

        // --- 4) JSON file selection ---
        var jsonGroup = panel.add('group');
        jsonGroup.orientation = 'row';
        jsonLabel = jsonGroup.add('statictext', undefined, 'Nenhum JSON selecionado');
        browseBtn = jsonGroup.add('button', undefined, 'Selecionar JSON...');

        // --- 5) Replicate button ---
        processBtn = panel.add('button', undefined, 'Replicar');

        // -- EVENT HANDLERS --

        // (A) Reload Comps
        reloadBtn.onClick = function () {
            populateCompList();
        };

        // (B) Set Fields (create text-layer dropdowns)
        setFieldsBtn.onClick = function () {
            clearLayerSelectors();
            var count = parseInt(fieldsCountInput.text, 10);
            if (isNaN(count) || count < 1) {
                alert('Informe um número inteiro positivo válido.');
                return;
            }
            createFieldSelectors(count);
        };

        // (C) Browse for JSON
        browseBtn.onClick = function () {
            var jsonFile = File.openDialog('Selecione um arquivo de dados JSON', '*.json');
            if (jsonFile && jsonFile.exists) {
                jsonLabel.text = decodeURI(jsonFile.fsName);
            }
        };

        // (D) Replicate Comps
        processBtn.onClick = replicateComps;

        // (E) Attempt to populate comps right now (in case a project is open)
        populateCompList();

        // Show the window if it's floating
        if (panel instanceof Window) {
            panel.center();
            panel.show();
        }
        return panel;
    }

    /**
     * populateCompList()
     * Clears the compDropdown and adds a list of all comps in the current project.
     */
    function populateCompList() {
        if (!compDropdown) return;
        compDropdown.removeAll();

        var project = app.project;
        if (project && project.numItems > 0) {
            for (var i = 1; i <= project.numItems; i++) {
                var item = project.item(i);
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
     * Dynamically creates `count` dropdown selectors in fieldsGroup,
     * each enumerating the text layers in the chosen composition.
     */
    function createFieldSelectors(count) {
        var selectedCompName = compDropdown.selection ? compDropdown.selection.text : null;
        if (!selectedCompName) {
            alert('Não foi selecionada uma composição.');
            return;
        }
        var templateComp = findCompByName(selectedCompName);
        if (!templateComp) {
            alert('A composição selecionada não foi encontrada.');
            return;
        }

        // Collect text-layer names
        var textLayers = [];
        for (var i = 1; i <= templateComp.numLayers; i++) {
            var lyr = templateComp.layer(i);
            if (lyr.matchName === 'ADBE Text Layer') {
                textLayers.push(lyr.name);
            }
        }

        // Create the specified number of dropdowns
        for (var k = 0; k < count; k++) {
            var row = fieldsGroup.add('group');
            row.orientation = 'row';

            row.add('statictext', undefined, 'Camada ' + (k + 1) + ':');
            var dd = row.add('dropdownlist', undefined, textLayers);
            if (textLayers.length > 0) {
                dd.selection = 0; // default
            }
            layerSelectors.push(dd);
        }

        // Force UI layout refresh
        fieldsGroup.layout.layout(true);
        mainPanel.layout.layout(true);
    }

    /**
     * clearLayerSelectors()
     * Removes all child UI elements from fieldsGroup (the dynamic selectors).
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
     * 1) Reads JSON file as array of objects.
     * 2) For each object, enumerates its values in order.
     * 3) Duplicates the chosen comp, sets each selected layer's text to the corresponding property value.
     */
    function replicateComps() {
        app.beginUndoGroup('Replicate Comps');
        try {
            var project = app.project;
            if (!project) {
                alert('Nenhum projeto foi carregado.');
                return;
            }

            // Check composition
            if (!compDropdown.selection) {
                alert('Primeiro selecione uma composição.');
                return;
            }
            var templateCompName = compDropdown.selection.text;
            var templateComp = findCompByName(templateCompName);
            if (!templateComp) {
                alert('Composição modelo não encontrada.');
                return;
            }

            // Check JSON
            var jsonPath = (jsonLabel && jsonLabel.text) ? jsonLabel.text : '';
            var dataFile = new File(jsonPath);
            if (!dataFile.exists) {
                alert('Selecione um arquivo JSON válido.');
                return;
            }

            dataFile.open('r');
            var content = dataFile.read();
            dataFile.close();
            var jsonData = JSON.parse(content);

            if (!Array.isArray(jsonData)) {
                alert('JSON deve ser uma lista de objetos de dados.');
                return;
            }

            // Make sure we have at least one field to process
            if (layerSelectors.length === 0) {
                alert('Você não selecionou nenhuma camada de texto. Clique em "Definir camadas de texto" após digitar o número de camadas.');
                return;
            }

            // For each object in the array...
            for (var i = 0; i < jsonData.length; i++) {
                var dataObj = jsonData[i];

                // Convert object properties to an array of values
                var objValues = [];
                for (var key in dataObj) {
                    if (dataObj.hasOwnProperty(key)) {
                        objValues.push(dataObj[key]);
                    }
                }

                // Duplicate the comp
                var newComp = templateComp.duplicate();
                newComp.name = templateComp.name + '_' + (i + 1);

                // For each layerSelector, set the text from the corresponding objValues index
                for (var s = 0; s < layerSelectors.length; s++) {
                    if (s >= objValues.length) break;  // No more values left
                    var selectedLayerName = layerSelectors[s].selection
                        ? layerSelectors[s].selection.text
                        : null;
                    if (!selectedLayerName) continue;

                    var targetLayer = findLayerByName(newComp, selectedLayerName);
                    if (!targetLayer) continue;

                    var sourceTextProp = targetLayer.property('Source Text');
                    if (sourceTextProp) {
                        var textDoc = sourceTextProp.value;
                        textDoc.text = objValues[s];
                        sourceTextProp.setValue(textDoc);
                    }
                }
            }

            alert('Foram replicadas com sucesso ' + jsonData.length + ' composições!');
        } catch (e) {
            alert('Error: ' + e.toString());
        } finally {
            app.endUndoGroup();
        }
    }

    /**
     * findCompByName(name)
     * Returns the first CompItem in the project with the given name.
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
