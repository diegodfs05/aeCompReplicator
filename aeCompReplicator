/**
 * myCompReplicator.jsx
 * 
 * Dockable ScriptUI panel that:
 *  1) Lists all comps in the current project for selection
 *  2) Lets user pick a JSON data file
 *  3) Generates duplicates of the selected comp, each
 *     with text layers replaced according to JSON array data
 */

(function (thisObj) {
    // Main function to create UI panel
    function buildUI(thisObj) {
        // Create a dockable panel if in AE, otherwise a floating window
        var panel = (thisObj instanceof Panel) 
            ? thisObj 
            : new Window('palette', 'Comp Replicator', undefined, {resizeable:true});
        
        // UI Elements
        var compDropdownLabel = panel.add('statictext', undefined, 'Select Composition:');
        var compDropdown = panel.add('dropdownlist', undefined, []);
        
        var jsonGroup = panel.add('group');
        jsonGroup.orientation = 'row';
        var jsonLabel = jsonGroup.add('statictext', undefined, 'No JSON selected');
        var browseBtn = jsonGroup.add('button', undefined, 'Browse JSON...');
        
        var processBtn = panel.add('button', undefined, 'Replicate Comps');
        
        // Populate the composition dropdown
        function populateCompList() {
            compDropdown.removeAll();
            var project = app.project;
            if (project && project.numItems > 0) {
                for (var i = 1; i <= project.numItems; i++) {
                    var item = project.item(i);
                    if (item && item instanceof CompItem) {
                        compDropdown.add('item', item.name);
                    }
                }
                if (compDropdown.items.length > 0) {
                    compDropdown.selection = 0;
                }
            }
        }
        
        // Event: Browse for JSON
        browseBtn.onClick = function() {
            var jsonFile = File.openDialog('Select JSON data file', '*.json');
            if (jsonFile && jsonFile.exists) {
                jsonLabel.text = decodeURI(jsonFile.fsName);
            }
        };
        
        // Event: Replicate Comps
        processBtn.onClick = function() {
            app.beginUndoGroup('Replicate Comps');
            
            try {
                var project = app.project;
                if (!project) {
                    alert('No project open.');
                    return;
                }
                
                // Validate composition choice
                if (!compDropdown || !compDropdown.selection) {
                    alert('Please select a composition first.');
                    return;
                }
                var templateCompName = compDropdown.selection.text;
                var templateComp = findCompByName(templateCompName);
                if (!templateComp) {
                    alert('Template composition not found in the project.');
                    return;
                }
                
                // Validate JSON
                var jsonPath = (jsonLabel && jsonLabel.text) ? jsonLabel.text : '';
                var dataFile = new File(jsonPath);
                if (!dataFile.exists) {
                    alert('Please select a valid JSON file.');
                    return;
                }
                
                // Read & parse JSON
                dataFile.open('r');
                var content = dataFile.read();
                dataFile.close();
                var jsonData = JSON.parse(content);
                
                // Check that jsonData is an array
                if (!Array.isArray(jsonData)) {
                    alert('JSON file must contain an array of data objects.');
                    return;
                }
                
                // For each object in the array, duplicate the comp and set text
                for (var i = 0; i < jsonData.length; i++) {
                    var dataObj = jsonData[i];
                    
                    // Duplicate composition
                    var newComp = templateComp.duplicate();
                    
                    // Optional: rename comp to something meaningful
                    newComp.name = templateComp.name + '_' + (i+1);
                    
                    // For each text layer, update text based on matching property in dataObj
                    for (var layerIndex = 1; layerIndex <= newComp.numLayers; layerIndex++) {
                        var layer = newComp.layer(layerIndex);
                        
                        // Check if it's a TextLayer
                        if (layer.matchName === 'ADBE Text Layer') {
                            var sourceTextProp = layer.property('Source Text');
                            var currentTextDoc = sourceTextProp.value;
                            
                            // We can try matching by layer name or some known property
                            // E.g. if the layer's name is "title", we look for dataObj.title
                            var layerName = layer.name;
                            
                            // If there's a matching key in dataObj, update text
                            if (dataObj.hasOwnProperty(layerName)) {
                                currentTextDoc.text = dataObj[layerName];
                                sourceTextProp.setValue(currentTextDoc);
                            }
                        }
                    }
                }
                
                alert('Successfully replicated ' + jsonData.length + ' compositions!');
            } catch (err) {
                alert('Error: ' + err.toString());
            } finally {
                app.endUndoGroup();
            }
        };
        
        // Helper: find comp by name
        function findCompByName(name) {
            var proj = app.project;
            for (var i = 1; i <= proj.numItems; i++) {
                var it = proj.item(i);
                if (it instanceof CompItem && it.name === name) {
                    return it;
                }
            }
            return null;
        }
        
        // Initialize
        populateCompList();
        
        // If a floating window, show it
        if (panel instanceof Window) {
            panel.center();
            panel.show();
        }
        
        return panel;
    }
    
    // Build or return the panel
    var myScriptPal = buildUI(thisObj);
    
    // If inside Adobe, allow for docking
    if (myScriptPal instanceof Window === false) {
        // Running in a Panel, so AE can manage it
        myScriptPal.layout.layout(true);
    }
    
})(this);
