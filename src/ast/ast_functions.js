BlockMirrorTextToBlocks['ast_Image'] = function (node, parent, textToBlocks) {
    if (!textToBlocks.blockMirror.configuration.imageMode) {
        throw "Not using image constructor";
    }
    if (node.args.length !== 1) {
        throw "More than one argument to Image constructor";
    }
    if (node.args[0]._astname !== "Str") {
        throw "First argument for Image constructor must be string literal";
    }
    return BlockMirrorTextToBlocks.create_block("ast_Image", node.lineno, {}, {}, {},
        {"@src": Sk.ffi.remapToJs(node.args[0].s)});
};
