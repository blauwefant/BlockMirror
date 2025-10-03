python.pythonGenerator.imports = new TypeRegistry();
python.pythonGenerator.variables = new TypesRegistry();

// Hook for cases where custom scrubbing needs to be undone
python.pythonGenerator.descrub_ = line => line

python.pythonGenerator.finish = function(code) {
    let importRegExp = /^(from\s+\S+\s+)?import\s+\S+/
    let lines = code.split('\n')
    let descrubbed_lines = lines.map(python.pythonGenerator.descrub_);
    let code_lines = []
    let imports = []
    let descrubbed_imports = []

    for (let [index, descrubbed_line] of descrubbed_lines.entries()) {
        if (descrubbed_line.match(importRegExp)) {
            descrubbed_imports.push(descrubbed_line)
            imports.push(lines[index])
        } else {
            code_lines.push(lines[index])
        }
    }

    for (let [name, type] of [...this.imports.entries()].sort()) {
        // Only add imports from the registry if not already defined in code
        if (!descrubbed_imports.some(function(item) {
            return item.match(new RegExp(`\\s+${name}\\s*(,.*)?$`));
        })) {
            if (name === type) {
                imports.push(`import ${type}`);
            } else {
                let lastIndexOfDot = type.lastIndexOf('.')
                let simpleType = type.substring(lastIndexOfDot + 1)
                if (simpleType === name) {
                    // TODO gather from statements first
                    let fromModule = type.substring(0, lastIndexOfDot)
                    imports.push(`from ${fromModule} import ${name}`)
                } else {
                    imports.push(`import ${type} as ${name}`);
                }
            }
        }
    }

    this.definitions_ = Object.create(null);
    this.functionNames_ = Object.create(null);
    this.isInitialized = false;
    this.imports.clear();
    this.variables.clear();

    this.nameDB_.reset();
    // acbart: Don't actually inject initializations - we don't need 'em.
    var allDefs = [...new Set(imports)].join('\n') + '\n\n';
    return allDefs.replace(/\n{3,}/g, '\n\n').replace(/\n*$/, '\n\n\n') + code_lines.join('\n').trimStart();
}

python.pythonGenerator.INDENT = '    ';

python.pythonGenerator.RESERVED_WORDS_ = (
    "False,None,True,and,as,assert,break,class," +
    "continue,def,del,elif,else,except,finally,for," +
    "from,global,if,import,in,is,lambda,nonlocal," +
    "not,or,pass,raise,return,try,while,with,yield"
);

/**
 * Naked values are top-level blocks with outputs that aren't plugged into
 * anything.
 * @param {string} line Line of generated code.
 * @return {string} Legal line of code.
 */
python.pythonGenerator.scrubNakedValue = function (line) {
    // acbart: Remove extra new line
    return line;
};


/**
 * Construct the blocks required by the flyout for the variable category.
 * @param {!Blockly.Workspace} workspace The workspace containing variables.
 * @return {!Array.<!Element>} Array of XML block elements.
 */
Blockly.Variables.flyoutCategoryBlocks = function (workspace) {
    var variableModelList = workspace.getVariablesOfType('');

    var xmlList = [];
    if (variableModelList.length > 0) {
        // New variables are added to the end of the variableModelList.
        var mostRecentVariableFieldXmlString =
                variableModelList[variableModelList.length - 1];
        if (!Blockly.Variables._HIDE_GETTERS_SETTERS && Blockly.Blocks['ast_Assign']) {
            let gap = Blockly.Blocks['ast_AugAssign'] ? 8 : 24;
            let blockText = '<xml>' +
                '<block type="ast_Assign" gap="' + gap + '">' +
                mostRecentVariableFieldXmlString +
                '</block>' +
                '</xml>';
            let block = Blockly.utils.xml.textToDom(blockText).firstChild;
            xmlList.push(block);
        }
        if (!Blockly.Variables._HIDE_GETTERS_SETTERS && Blockly.Blocks['ast_AugAssign']) {
            let gap = Blockly.Blocks['ast_Name'] ? 20 : 8;
            let blockText = '<xml>' +
                '<block type="ast_AugAssign" gap="' + gap + '">' +
                mostRecentVariableFieldXmlString +
                '<value name="VALUE">' +
                '<shadow type="ast_Num">' +
                '<field name="NUM">1</field>' +
                '</shadow>' +
                '</value>' +
                '<mutation options="false" simple="true"></mutation>' +
                '</block>' +
                '</xml>';
            let block = Blockly.utils.xml.textToDom(blockText).firstChild;
            xmlList.push(block);
        }

        if (Blockly.Blocks['ast_Name']) {
            variableModelList.sort(Blockly.VariableModel.compareByName);
            for (let i = 0, variable; variable = variableModelList[i]; i++) {
                if (!Blockly.Variables._HIDE_GETTERS_SETTERS) {
                    let block = Blockly.utils.xml.createElement('block');
                    block.setAttribute('type', 'ast_Name');
                    block.setAttribute('gap', 8);
                    block.appendChild(Blockly.Variables.generateVariableFieldDom(variable));
                    xmlList.push(block);
                } else {
                    block = Blockly.utils.xml.createElement('label');
                    block.setAttribute('text', variable.name);
                    block.setAttribute('web-class', 'blockmirror-toolbox-variable');
                    //block.setAttribute('gap', 8);
                    xmlList.push(block);
                }
            }
        }
    }
    return xmlList;
};

//******************************************************************************
// Hacks to make variable names case-sensitive

/**
 * A custom compare function for the VariableModel objects.
 * @param {Blockly.VariableModel} var1 First variable to compare.
 * @param {Blockly.VariableModel} var2 Second variable to compare.
 * @return {number} -1 if name of var1 is less than name of var2, 0 if equal,
 *     and 1 if greater.
 * @package
 */
Blockly.VariableModel.compareByName = function(var1, var2) {
  var name1 = var1.name;
  var name2 = var2.name;
  if (name1 < name2) {
    return -1;
  } else if (name1 === name2) {
    return 0;
  } else {
    return 1;
  }
};

Blockly.Names.prototype.getName = function(name, type) {
  if (type == Blockly.VARIABLE_CATEGORY_NAME) {
    var varName = null;
    const variable = this.variableMap.getVariableById(name);
    if (variable) {
      varName = variable.name;
    }
    if (varName) {
      name = varName;
    }
  }
  var normalized = name + '_' + type;

  var isVarType = type == Blockly.VARIABLE_CATEGORY_NAME ||
      type == Blockly.Names.DEVELOPER_VARIABLE_TYPE;

  var prefix = isVarType ? this.variablePrefix : '';
  if (normalized in this.db) {
    return prefix + this.db[normalized];
  }
  var safeName = this.getDistinctName(name, type);
  this.db[normalized] = safeName.substr(prefix.length);
  return safeName;
};

Blockly.Names.equals = function(name1, name2) {
  return name1 == name2;
};

Blockly.Variables.nameUsedWithOtherType = function(name, type, workspace) {
  var allVariables = workspace.getVariableMap().getAllVariables();

  for (var i = 0, variable; (variable = allVariables[i]); i++) {
    if (variable.name == name && variable.type != type) {
      return variable;
    }
  }
  return null;
};

Blockly.Variables.nameUsedWithAnyType = function(name, workspace) {
  var allVariables = workspace.getVariableMap().getAllVariables();

  for (var i = 0, variable; (variable = allVariables[i]); i++) {
    if (variable.name == name) {
      return variable;
    }
  }
  return null;
};