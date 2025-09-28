BlockMirrorTextToBlocks.BLOCKS.push({
    "type": "ast_Expr",
    "message0": "do nothing with %1",
    "args0": [
        {"type": "input_value", "name": "VALUE"}
    ],
    "inputsInline": false,
    "previousStatement": null,
    "nextStatement": null,
    "colour": BlockMirrorTextToBlocks.COLOR.PYTHON,
});

python.pythonGenerator.forBlock['ast_Expr'] = function(block, generator) {
    // Numeric value.
    let order = python.Order.NONE;

    // Generate more optimal parentheses:
    for (const childBlock of block.getChildren()) {
        if (childBlock.type === 'ast_Expr') {
            // Nothing to do
        } else if (childBlock.type === 'ast_Call') {
            order = Math.min(order, python.Order.FUNCTION_CALL)
        } else if (childBlock.type === "ast_Attribute") {
            order = Math.min(order, python.Order.MEMBER);
        } else {
            order = Math.min(order, python.Order.ATOMIC)
        }
    }

    var value = python.pythonGenerator.valueToCode(block, 'VALUE', order) || python.pythonGenerator.blank;
    // TODO: Assemble JavaScript into code variable.
    return value+"\n";
};

BlockMirrorTextToBlocks.prototype['ast_Expr'] = function (node, parent) {
    let converted = this.convert(node.value, node);

    if (converted.constructor === Array) {
        return converted[0];
    }

    return BlockMirrorTextToBlocks.create_block("ast_Expr", node.lineno, {}, {
        "VALUE": converted
    });
};
