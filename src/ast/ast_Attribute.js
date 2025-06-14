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
    },
    mutationToDom: function () {
        var container = document.createElement('mutation');
        container.setAttribute('premessage', this.premessage_);
        container.setAttribute('message', this.message_);
        container.setAttribute('postmessage', this.postmessage_);
        container.setAttribute('returns', this.returns_);
        return container;
    },
    domToMutation: function (xmlElement) {
        this.premessage_ = xmlElement.getAttribute('premessage');
        this.message_ = xmlElement.getAttribute('message');
        this.postmessage_ = xmlElement.getAttribute('postmessage');
        this.returns_ = xmlElement.getAttribute('returns');
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
    },
    mutationToDom: function () {
        var container = document.createElement('mutation');
        container.setAttribute('premessage', this.premessage_);
        container.setAttribute('message', this.message_);
        container.setAttribute('postmessage', this.postmessage_);
        container.setAttribute('returns', this.returns_);
        return container;
    },
    domToMutation: function (xmlElement) {
        this.premessage_ = xmlElement.getAttribute('premessage');
        this.message_ = xmlElement.getAttribute('message');
        this.postmessage_ = xmlElement.getAttribute('postmessage');
        this.returns_ = xmlElement.getAttribute('returns');
        this.updateShape_();
    },
    updateShape_: function () {
        this.getField('premessage').setValue(this.premessage_)
        this.getField('message').setValue(this.message_)
        this.getField('postmessage').setValue(this.postmessage_)
    },
};

python.pythonGenerator.forBlock['ast_Attribute'] = function(block, generator) {
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
    // Text value.
    var value = python.pythonGenerator.valueToCode(block, 'VALUE', python.Order.NONE) || python.pythonGenerator.blank;
    var attr = block.getFieldValue('ATTR');
    let code = value + "." + attr;

    if (block.outputConnection && block.outputConnection.targetBlock()) {
        return [code, python.Order.MEMBER];
    }
    return code + "\n";
};

BlockMirrorTextToBlocks.prototype['ast_Attribute'] = function (node, parent) {
    let value = node.value;
    let attr = node.attr;
    let returns = 'Any';

    let mutations = {
        "@returns": returns,
        "@premessage": '',
        "@message": '',
        "@postmessage": '',
    };

    let fromLibrary = this.resolveFromLibrary(node)

    if (fromLibrary instanceof PythonAttribute) {
        mutations["@premessage"] = fromLibrary.premessage
        mutations["@message"] = fromLibrary.message
        mutations["@postmessage"] = fromLibrary.postmessage
        mutations["@returns"] = fromLibrary.typeHint ?? returns
    }

    let newBlock

    if (!this.blockMirror.configuration.preferFullAttributeBlocks && value._astname === "Name") {
        newBlock = BlockMirrorTextToBlocks.create_block("ast_Attribute", node.lineno, {
            "VALUE": Sk.ffi.remapToJs(value.id),
            "ATTR": Sk.ffi.remapToJs(attr)
        }, {}, {}, mutations);
    } else {
        newBlock = BlockMirrorTextToBlocks.create_block("ast_AttributeFull", node.lineno, {
            "ATTR": Sk.ffi.remapToJs(attr)
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
