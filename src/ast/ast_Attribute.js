Blockly.Blocks['ast_AttributeFull'] = {
    init: function () {
        this.setInputsInline(true);
        this.setOutput(true, null);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(BlockMirrorTextToBlocks.COLOR.OO);
        this.appendValueInput('VALUE').appendField(' ', 'premessage');
        this.appendDummyInput('NAME')
            .appendField('.', 'message')
            .appendField(new Blockly.FieldTextInput('default'), 'ATTR')
            .appendField(' ', 'postmessage');
        this.returns_ = 'Any';
        this.import_ = "";
    },
    mutationToDom: function () {
        var container = document.createElement('mutation');
        container.setAttribute('premessage', this.premessage_);
        container.setAttribute('message', this.message_);
        container.setAttribute('postmessage', this.postmessage_);
        container.setAttribute('returns', this.returns_);
        container.setAttribute('import', this.import_);
        return container;
    },
    domToMutation: function (xmlElement) {
        this.premessage_ = xmlElement.getAttribute('premessage');
        this.message_ = xmlElement.getAttribute('message');
        this.postmessage_ = xmlElement.getAttribute('postmessage');
        this.returns_ = xmlElement.getAttribute('returns');
        this.import_ = xmlElement.getAttribute('import');
        this.updateShape_();
    },
    updateShape_: function () {
        this.getField('premessage').setValue(this.premessage_)
        this.getField('message').setValue(this.message_)
        this.getField('postmessage').setValue(this.postmessage_)
    },
};

Blockly.Blocks['ast_Attribute'] = {
    init: function () {
        this.setInputsInline(true);
        this.setOutput(true, null);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(BlockMirrorTextToBlocks.COLOR.OO);
        this.appendDummyInput('NAME').appendField(' ', 'premessage')
            .appendField(new Blockly.FieldVariable('variable'), 'VALUE')
            .appendField('.', 'message')
            .appendField(new Blockly.FieldTextInput('attribute'), 'ATTR')
            .appendField(' ', 'postmessage');
        this.returns_ = 'Any';
        this.import_ = "";
    },
    mutationToDom: function () {
        var container = document.createElement('mutation');
        container.setAttribute('premessage', this.premessage_);
        container.setAttribute('message', this.message_);
        container.setAttribute('postmessage', this.postmessage_);
        container.setAttribute('returns', this.returns_);
        container.setAttribute('import', this.import_);
        return container;
    },
    domToMutation: function (xmlElement) {
        this.premessage_ = xmlElement.getAttribute('premessage');
        this.message_ = xmlElement.getAttribute('message');
        this.postmessage_ = xmlElement.getAttribute('postmessage');
        this.returns_ = xmlElement.getAttribute('returns');
        this.import_ = xmlElement.getAttribute('import');
        this.updateShape_();
    },
    updateShape_: function () {
        this.getField('premessage').setValue(this.premessage_)
        this.getField('message').setValue(this.message_)
        this.getField('postmessage').setValue(this.postmessage_)
    },
};

function _handle_attribute_imports(block) {
    if (block.import_) {
        let [type, alias] = block.import_.split(' as ', 2)

        if (type && !python.pythonGenerator.imports.hasType(type)) {
            let name = alias ?? type;
            python.pythonGenerator.imports.set(type, name);
        }
    }
}

python.pythonGenerator.forBlock['ast_Attribute'] = function(block, generator) {
    _handle_attribute_imports(block);
    // Text value.
    var value = python.pythonGenerator.getVariableName(block.getFieldValue('VALUE'),
        Blockly.Variables.NAME_TYPE);
    var attr = block.getFieldValue('ATTR');
    let code = value + "." + attr;

    if (block.outputConnection && block.outputConnection.targetBlock()) {
        // Return as expression
        return [code, python.Order.MEMBER];
    }
    return code + "\n";
};

python.pythonGenerator.forBlock['ast_AttributeFull'] = function(block, generator) {
    _handle_attribute_imports(block);
    // Text value.
    var value = python.pythonGenerator.valueToCode(block, 'VALUE', python.Order.NONE) || python.pythonGenerator.blank;
    var resolvedValue = python.pythonGenerator.imports.getType(value) ?? value

    var attr = block.getFieldValue('ATTR');
    let code = resolvedValue + "." + attr;

    if (block.outputConnection && block.outputConnection.targetBlock()) {
        return [code, python.Order.MEMBER];
    }
    return code + "\n";
};

BlockMirrorTextToBlocks.prototype['ast_Attribute'] = function (node, parent) {
    let value = node.value;
    let attrStr = Sk.ffi.remapToJs(node.attr)
    let returns = 'Any';

    let mutations = {
        "@returns": returns,
        "@premessage": '',
        "@message": '',
        "@postmessage": '',
        "@import": ''
    };

    let fromLibrary = this.resolveFromLibrary(node)
    let alias = null

    if (fromLibrary instanceof PythonAttribute) {
        mutations["@premessage"] = fromLibrary.premessage
        mutations["@message"] = fromLibrary.message
        mutations["@postmessage"] = fromLibrary.postmessage
        mutations["@returns"] = fromLibrary.typeHint ?? returns
        mutations["@import"] = fromLibrary.pythonClass?.requiresImport ?? fromLibrary.pythonModule.requiresImport ?? ""
    } else if (fromLibrary instanceof PythonClass || fromLibrary instanceof PythonModule) {
        if (fromLibrary.requiresImport) {
            mutations["@import"] = fromLibrary.requiresImport
            let type
            [type, alias] = fromLibrary.requiresImport.split(' as ', 2)
        }
    }

    let newBlock

    if (alias != null) {
        newBlock = BlockMirrorTextToBlocks.create_block('ast_Name', node.lineno, {
            "VAR": attrStr
        },  {}, {}, {"@import": mutations["@import"]});
    } else if (!this.blockMirror.configuration.preferFullAttributeBlocks && value._astname === "Name") {
        newBlock = BlockMirrorTextToBlocks.create_block("ast_Attribute", node.lineno, {
            "VALUE": Sk.ffi.remapToJs(value.id),
            "ATTR": attrStr
        }, {}, {}, mutations);
    } else {
        newBlock = BlockMirrorTextToBlocks.create_block("ast_AttributeFull", node.lineno, {
            "ATTR": attrStr
        }, {
            "VALUE": this.convert(value, node)
        }, {}, mutations);
    }

    if (this.isStatementContainer(parent)) {
        // Return as statement
        return [newBlock];
    } else {
        // Return as expression
        return newBlock;
    }
}
