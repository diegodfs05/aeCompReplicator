# aeCompReplicator

<details> 
   <summary><strong>Clique para expandir README.md</strong></summary>

   # myCompReplicator

   A simple After Effects script for replicating a chosen "template" composition according to JSON data.

   ## Installation

   1. **Locate your After Effects Scripts folder**. 
      - On Windows: `C:\Program Files\Adobe\Adobe After Effects <version>\Support Files\Scripts\ScriptUI Panels`
      - On Mac: `/Applications/Adobe After Effects <version>/Scripts/ScriptUI Panels`
      
   2. **Place `myCompReplicator.jsx`** in the `ScriptUI Panels` folder.

   3. (Optional) Copy `exampleData.json` anywhere you like; it can be in `Documents`, on the Desktop, etc.

   4. **Enable scripts to write files** if needed: 
      After Effects → Preferences → Scripting & Expressions → Allow Scripts to Write Files and Access Network.

   ## Usage

   1. **Open After Effects** and load or create a project that contains your “template” composition with text layers. 
      - Ensure your text layers have distinct and meaningful layer names (e.g. "title", "subtitle", etc.) that match keys in your JSON.

   2. **Open the Script**:
      - Go to `Window → myCompReplicator.jsx`
      - A panel labeled "Comp Replicator" will appear.

   3. **Select Composition**: 
      - From the dropdown, pick the composition you want to replicate.

   4. **Select JSON**:
      - Click "Browse JSON..." to locate your `.json` file.

   5. **Replicate**:
      - Click "Replicate Comps". 
      - The script will create duplicates of your selected composition, one for each object in the JSON array.
      - Each text layer is updated if the layer name matches a key in the JSON object.

   Estrutura de pacote:
   aeCompReplicator/ 
      ├── myCompReplicator.jsx 
      ├── exampleData.json 
      └── README.md

   ## Notes

   - The script updates text layers based on matching layer names to property names in the JSON object. If a layer is named "subtitle" and the JSON object has a `"subtitle": "Some text"`, that layer’s text will be set to "Some text".
   - If the script doesn’t find a matching key, it leaves the layer’s text unchanged.
   - The script duplicates the comp in your project panel. By default, each duplicate is named `<originalCompName>_#`.
   - Check the After Effects Console or watch out for alerts if something goes wrong (e.g., invalid JSON file).

   ## License

   Feel free to modify and use as you see fit for your own AE workflows!

</details>
