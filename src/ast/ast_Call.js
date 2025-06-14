// TODO: Support stuff like "append" where the message is after the value input
// TODO: Handle updating function/method definition -> update call
// TODO: Do a pretraversal to determine if a given function returns

Blockly.Blocks['ast_Call'] = {
    /**
     * Block for calling a procedure with no return value.
     * @this Blockly.Block
     */
    init: function () {
        this.givenColour_ = BlockMirrorTextToBlocks.COLOR.FUNCTIONS
        this.setInputsInline(true);
        // Regular ('NAME') or Keyword (either '**' or '*NAME')
        this.arguments_ = [];
        this.argumentVarModels_ = [];
        // acbart: Added count to keep track of unused parameters
        this.argumentCount_ = 0;
        this.quarkConnections_ = {};
        this.quarkIds_ = null;
        // acbart: Show parameter names, if they exist
        this.showParameterNames_ = false;
        // acbart: Whether this block returns
        this.returns_ = 'Any';
        // acbart: added simpleName to handle complex function calls (e.g., chained)
        this.isMethod_ = false;
        this.name_ = null;
        this.message_ = "function";
        this.premessage_ = "";
        this.module_ = "";
        this.fromLibrary_ = null;
        this.updateShape_();
    },

    /**
     * Returns the name of the procedure this block calls.
     * @return {string} Procedure name.
     * @this Blockly.Block
     */
    getProcedureCall: function () {
        return this.name_;
    },
    /**
     * Notification that a procedure is renaming.
     * If the name matches this block's procedure, rename it.
     * Also rename if it was previously null.
     * @param {string} oldName Previous name of procedure.
     * @param {string} newName Renamed procedure.
     * @this Blockly.Block
     */
    renameProcedure: function (oldName, newName) {
        if (this.name_ === null ||
            Blockly.Names.equals(oldName, this.name_)) {
            this.name_ = newName;
            this.updateShape_();
        }
    },
    /**
     * Notification that the procedure's parameters have changed.
     * @param {!Array.<string>} paramNames New param names, e.g. ['x', 'y', 'z'].
     * @param {!Array.<string>} paramIds IDs of params (consistent for each
     *     parameter through the life of a mutator, regardless of param renaming),
     *     e.g. ['piua', 'f8b_', 'oi.o'].
     * @private
     * @this Blockly.Block
     */
    setProcedureParameters_: function (paramNames, paramIds) {
        // Data structures:
        // this.arguments = ['x', 'y']
        //     Existing param names.
        // this.quarkConnections_ {piua: null, f8b_: Blockly.Connection}
        //     Look-up of paramIds to connections plugged into the call block.
        // this.quarkIds_ = ['piua', 'f8b_']
        //     Existing param IDs.
        // Note that quarkConnections_ may include IDs that no longer exist, but
        // which might reappear if a param is reattached in the mutator.
        var defBlock = Blockly.Procedures.getDefinition(this.getProcedureCall(),
            this.workspace);
        var mutatorOpen = defBlock && defBlock.mutator &&
            defBlock.mutator.isVisible();
        if (!mutatorOpen) {
            this.quarkConnections_ = {};
            this.quarkIds_ = null;
        }
        if (!paramIds) {
            // Reset the quarks (a mutator is about to open).
            return false;
        }
        // Test arguments (arrays of strings) for changes. '\n' is not a valid
        // argument name character, so it is a valid delimiter here.
        if (paramNames.join('\n') === this.arguments_.join('\n')) {
            // No change.
            this.quarkIds_ = paramIds;
            return false;
        }
        if (paramIds.length !== paramNames.length) {
            throw RangeError('paramNames and paramIds must be the same length.');
        }
        this.setCollapsed(false);
        if (!this.quarkIds_) {
            // Initialize tracking for this block.
            this.quarkConnections_ = {};
            this.quarkIds_ = [];
        }
        // Switch off rendering while the block is rebuilt.
        var savedRendered = this.rendered;
        this.rendered = false;
        // Update the quarkConnections_ with existing connections.
        for (let i = 0; i < this.arguments_.length; i++) {
            var input = this.getInput('ARG' + i);
            if (input) {
                let connection = input.connection.targetConnection;
                this.quarkConnections_[this.quarkIds_[i]] = connection;
                if (mutatorOpen && connection &&
                    paramIds.indexOf(this.quarkIds_[i]) === -1) {
                    // This connection should no longer be attached to this block.
                    connection.disconnect();
                    connection.getSourceBlock().bumpNeighbours_();
                }
            }
        }
        // Rebuild the block's arguments.
        this.arguments_ = [].concat(paramNames);
        this.argumentCount_ = this.arguments_.length;
        // And rebuild the argument model list.
        this.argumentVarModels_ = [];
        /*
        // acbart: Function calls don't create variables, what do they know?
        for (let i = 0; i < this.arguments_.length; i++) {
            let argumentName = this.arguments_[i];
            var variable = Blockly.Variables.getVariable(
                this.workspace, null, this.arguments_[i], '');
            if (variable) {
                this.argumentVarModels_.push(variable);
            }
        }*/

        this.updateShape_();
        this.quarkIds_ = paramIds;
        // Reconnect any child blocks.
        if (this.quarkIds_) {
            for (let i = 0; i < this.arguments_.length; i++) {
                var quarkId = this.quarkIds_[i];
                if (quarkId in this.quarkConnections_) {
                    let connection = this.quarkConnections_[quarkId];
                    if (!connection?.reconnect(this, 'ARG' + i)) {
                        // Block no longer exists or has been attached elsewhere.
                        delete this.quarkConnections_[quarkId];
                    }
                }
            }
        }
        // Restore rendering and show the changes.
        this.rendered = savedRendered;
        if (this.rendered) {
            this.render();
        }
        return true;
    },
    /**
     * Modify this block to have the correct number of arguments.
     * @private
     * @this Blockly.Block
     */
    updateShape_: function () {
        // If it's a method, add in the caller
        if (this.isMethod_ && !this.getInput('FUNC')) {
            let func = this.appendValueInput('FUNC');
            // If there's a premessage, add it in
            if (this.premessage_ !== "") {
                func.appendField(this.premessage_);
            }
        } else if (!this.isMethod_ && this.getInput('FUNC')) {
            this.removeInput('FUNC');
        }

        let drawnArgumentCount = this.getDrawnArgumentCount_();
        let message = this.getInput('MESSAGE_AREA')
        // Zero arguments, just do {message()}
        if (drawnArgumentCount === 0) {
            if (message) {
                message.removeField('MESSAGE');
            } else {
                message = this.appendDummyInput('MESSAGE_AREA')
                    .setAlign(Blockly.inputs.Align.RIGHT);
            }
            message.appendField(new Blockly.FieldLabel(this.message_ + "\ ("), 'MESSAGE');
            // One argument, no MESSAGE_AREA
        } else if (message) {
            this.removeInput('MESSAGE_AREA');
        }
        // Process arguments
        let i;
        for (i = 0; i < drawnArgumentCount; i++) {
            let argument = this.arguments_[i];
            let argumentName = this.parseArgument_(argument);
            if (i === 0) {
                argumentName = this.message_ + "\ (" + argumentName;
            }
            let field = this.getField('ARGNAME' + i);
            if (field) {
                // Ensure argument name is up to date.
                // The argument name field is deterministic based on the mutation,
                // no need to fire a change event.
                Blockly.Events.disable();
                try {
                    field.setValue(argumentName);
                } finally {
                    Blockly.Events.enable();
                }
            } else {
                // Add new input.
                field = new Blockly.FieldLabel(argumentName);
                this.appendValueInput('ARG' + i)
                    .setAlign(Blockly.inputs.Align.RIGHT)
                    .appendField(field, 'ARGNAME' + i)
                    .init();
            }
            if (argumentName) {
                field.setVisible(true);
            } else {
                field.setVisible(false);
            }
        }

        // Closing parentheses
        if (!this.getInput('CLOSE_PAREN')) {
            this.appendDummyInput('CLOSE_PAREN')
                .setAlign(Blockly.inputs.Align.RIGHT)
                .appendField(new Blockly.FieldLabel(")"));
        }

        // Move everything into place
        if (drawnArgumentCount === 0) {
            if (this.isMethod_) {
                this.moveInputBefore('FUNC', 'MESSAGE_AREA');
            }
            this.moveInputBefore('MESSAGE_AREA', 'CLOSE_PAREN');
        } else {
            if (this.isMethod_) {
                this.moveInputBefore('FUNC', 'CLOSE_PAREN');
            }
        }
        for (let j = 0; j < i; j++) {
            this.moveInputBefore('ARG' + j, 'CLOSE_PAREN')
        }

        // Set return state
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setOutput(this.returns_ !== 'None');

        // Remove deleted inputs.
        while (this.getInput('ARG' + i)) {
            this.removeInput('ARG' + i);
            i++;
        }

        this.setColour(this.givenColour_);
    }
    ,
    /**
     * Create XML to represent the (non-editable) name and arguments.
     * @return {!Element} XML storage element.
     * @this Blockly.Block
     */
    mutationToDom: function () {
        var container = document.createElement('mutation');
        let name = this.getProcedureCall();
        container.setAttribute('name', name === null ? '*' : name);
        container.setAttribute('arguments', this.argumentCount_);
        container.setAttribute('returns', this.returns_);
        container.setAttribute('parameters', this.showParameterNames_);
        container.setAttribute('method', this.isMethod_);
        container.setAttribute('message', this.message_);
        container.setAttribute('premessage', this.premessage_);
        container.setAttribute('module', this.module_);
        container.setAttribute('fromlibrary', this.fromLibrary_);
        container.setAttribute('colour', this.givenColour_);
        for (var i = 0; i < this.arguments_.length; i++) {
            var parameter = document.createElement('arg');
            parameter.setAttribute('name', this.arguments_[i]);
            container.appendChild(parameter);
        }
        return container;
    },
    /**
     * Parse XML to restore the (non-editable) name and parameters.
     * @param {!Element} xmlElement XML storage element.
     * @this Blockly.Block
     */
    domToMutation: function (xmlElement) {
        this.name_ = xmlElement.getAttribute('name');
        this.name_ = this.name_ === '*' ? null : this.name_;
        this.argumentCount_ = parseInt(xmlElement.getAttribute('arguments'), 10);
        this.showParameterNames_ = "true" === xmlElement.getAttribute('parameters');
        this.returns_ = xmlElement.getAttribute('returns');
        this.isMethod_ = "true" === xmlElement.getAttribute('method');
        this.message_ = xmlElement.getAttribute('message');
        this.premessage_ = xmlElement.getAttribute('premessage');
        this.module_ = xmlElement.getAttribute('module');
        this.fromLibrary_ = xmlElement.getAttribute('fromlibrary');
        this.givenColour_ = parseInt(xmlElement.getAttribute('colour'), 10);

        var args = [];
        var paramIds = [];
        for (var i = 0, childNode; childNode = xmlElement.childNodes[i]; i++) {
            if (childNode.nodeName.toLowerCase() === 'arg') {
                args.push(childNode.getAttribute('name'));
                paramIds.push(childNode.getAttribute('paramId'));
            }
        }
        let result = this.setProcedureParameters_(args, paramIds);
        if (!result) {
            this.updateShape_();
        }
        if (this.name_ !== null) {
            this.renameProcedure(this.getProcedureCall(), this.name_);
        }
    },
    /**
     * Return all variables referenced by this block.
     * @return {!Array.<!Blockly.VariableModel>} List of variable models.
     * @this Blockly.Block
     */
    getVarModels: function () {
        return this.argumentVarModels_;
    }
    ,
    /**
     * Add menu option to find the definition block for this call.
     * @param {!Array} options List of menu options to add to.
     * @this Blockly.Block
     */
    customContextMenu: function (options) {
        if (!this.workspace.isMovable()) {
            // If we center on the block and the workspace is not movable,
            // we could lose blocks at the edges of the workspace.
            return;
        }

        let workspace = this.workspace;
        let block = this;

        // Highlight Definition
        let option = {enabled: true};
        option.text = Blockly.Msg['PROCEDURES_HIGHLIGHT_DEF'];
        let name = this.getProcedureCall();
        option.callback = function () {
            let def = Blockly.Procedures.getDefinition(name, workspace);
            if (def) {
                workspace.centerOnBlock(def.id);
                def.select();
            }
        };
        options.push(option);

        // Show Parameter Names
        options.push({
            enabled: true,
            text: "Show/Hide parameters",
            callback: function () {
                block.showParameterNames_ = !block.showParameterNames_;
                block.updateShape_();
                block.render();
            }
        });
    },

    //defType_: 'procedures_defnoreturn',
    parseArgument_: function (argument) {
        if (argument.startsWith('KWARGS:')) {
            // KWARG
            return "unpack";
        } else if (argument.startsWith('KEYWORD:')) {
            return argument.substring(8) + "=";
        } else {
            if (this.showParameterNames_) {
                if (argument.startsWith("KNOWN_ARG:")) {
                    return argument.substring(10) + "=";
                }
            }
        }
        return "";
    },
    getDrawnArgumentCount_: function () {
        return Math.min(this.argumentCount_, this.arguments_.length);
    }
};

python.pythonGenerator.forBlock['ast_Call'] = function(block, generator) {
    if (block.module_) {
        let [type, alias] = block.module_.split(' as ', 2)

        if (type && !python.pythonGenerator.imports.hasType(type)) {
            let name = alias ?? type;
            python.pythonGenerator.imports.set(type, name);
        }
    }
    // Get the caller
    let funcName, fromLibrary
    if (block.isMethod_) {
        let caller = python.pythonGenerator.valueToCode(block, 'FUNC', python.Order.FUNCTION_CALL) ||
            python.pythonGenerator.blank;
        funcName = caller + this.name_
        let funcInputTargetBlock = block.getInputTargetBlock('FUNC')

        if (funcInputTargetBlock?.returns_) {
            fromLibrary = generator.libraries.resolve(funcInputTargetBlock.returns_ + this.name_)
        } else {
            let resolvedCaller = python.pythonGenerator.variables.getSingleType(caller) ?? caller
            resolvedCaller = python.pythonGenerator.imports.getType(resolvedCaller) ?? resolvedCaller
            fromLibrary = generator.libraries.resolve(resolvedCaller + this.name_)
        }
    } else {
        funcName = this.name_;
        fromLibrary = generator.libraries.resolve(this.name_)
    }

    if (fromLibrary) {
        // Save library item to the block, in case it changed
        block.fromLibrary_ = fromLibrary.fullName
    } else if (block.fromLibrary_) {
        // Fall back to previously resolved library item
        fromLibrary = generator.libraries.resolve(block.fromLibrary_)
    }

    if (fromLibrary instanceof PythonClass) {
        fromLibrary = fromLibrary.members.get("__init__") ?? fromLibrary
    }

    if (fromLibrary instanceof PythonFunction) {
        // Needed in case values were modified, but no blocks dragged.
        fromLibrary.applyShadow(block)
    }

    // Build the arguments
    var args = [];
    for (var i = 0; i < block.arguments_.length; i++) {
        let argBlock = block.getInputTargetBlock('ARG' + i)

        if (argBlock && argBlock.shadow) {
            continue
        }

        let value = python.pythonGenerator.valueToCode(block, 'ARG' + i,
            python.Order.NONE) || python.pythonGenerator.blank
        let argument = block.arguments_[i];

        if (argument.startsWith('KWARGS:')) {
            args.push("**" + value);
        } else if (argument.startsWith('KEYWORD:')) {
            let keyword = argument.substring(8)
            args.push(keyword + "=" + value);
        } else {
            args.push(value);
        }
    }

    // Return the result
    let code = funcName + '(' + args.join(', ') + ')';
    if (block.outputConnection && block.outputConnection.targetBlock()) {
        // Return as expression
        return [code, python.Order.FUNCTION_CALL];
    }

    return code + "\n";
};

//                              messageBefore, message, name
// function call: print() -> "print" ([message]) ; print
// Module function: plt.show() -> "show plot" ([plot]) ; plt.show
// Method call: "test".title() -> "make" [str] "title case" () ; .title ; isMethod = true

// let replaceTagName = function(element, tagName) {
//     let replacementElement = document.createElement(tagName);
//
//     for (let i = 0, l = element.attributes.length; i < l; ++i) {
//         let nodeName = element.attributes.item(i).nodeName;
//         let nodeValue = element.attributes.item(i).nodeValue;
//         replacementElement.setAttribute(nodeName, nodeValue);
//     }
//
//     replacementElement.innerHTML = element.innerHTML;
//     element.parentNode.replaceChild(replacementElement, element);
// };

BlockMirrorTextToBlocks.prototype['ast_Call'] = function (node, parent) {
    let func = node.func;
    let args = node.args;
    let keywords = node.keywords;
    let isMethod = false;
    let module = null;
    let premessage = "";
    let message = "";
    let name = "";
    let caller = null;
    let colour = BlockMirrorTextToBlocks.COLOR.FUNCTIONS;
    let returns = 'Any';
    let fromLibrary = this.resolveFromLibrary(func)

    if (func._astname === 'Name') {
        message = name = Sk.ffi.remapToJs(func.id);
    } else if (func._astname === 'Attribute') {
        isMethod = true;
        caller = func.value;
        let attributeName = Sk.ffi.remapToJs(func.attr);
        name = "." + attributeName;
        message = name
    } else {
        isMethod = true;
        caller = func;
        message = "";
        name = "";
        // (lambda x: x)()
    }

    if (fromLibrary) {
        if (fromLibrary instanceof PythonClass) {
            fromLibrary = fromLibrary.members.get("__init__") ?? fromLibrary
        }

        if (fromLibrary instanceof PythonFunction) {
            if (fromLibrary instanceof PythonMethod && !(fromLibrary instanceof PythonConstructorMethod) && !(fromLibrary.classmethod || fromLibrary.staticmethod)) {
                // Regular instance method, no import needed
                module = ""
            } else {
                module = fromLibrary.pythonClass?.requiresImport ?? fromLibrary.pythonModule.requiresImport
            }

            name = fromLibrary.name;
            premessage = fromLibrary.premessage
            message = fromLibrary.message
            returns = fromLibrary.typeHint

            if (fromLibrary instanceof PythonConstructorMethod) {
                name = fromLibrary.pythonClass.name
                returns = fromLibrary.pythonClass.fullName
            } else if (fromLibrary instanceof PythonMethod) {
                // For static and class methods, the caller is fixed
                isMethod = !fromLibrary.staticmethod && !fromLibrary.classmethod

                if (isMethod) {
                    caller = func.value
                    name = "." + fromLibrary.name;
                } else {
                    name = fromLibrary.pythonClass.name + "." + fromLibrary.name;
                }
            } else {
                // For functions, the caller is fixed
                isMethod = false;

                if (fromLibrary.pythonModule.name === "") {
                    name = fromLibrary.name;
                } else {
                    name = fromLibrary.pythonModule.name + "." + fromLibrary.name;
                }
            }
        } else {
            throw new TypeError("Unexpected type from library: " + fromLibrary.constructor.name + " for " + func)
        }
    }

    if (fromLibrary) {
        if (fromLibrary.custom) {
            try {
                return fromLibrary.custom(node, parent, this)
            } catch (e) {
                console.error(e);
                // We tried to be fancy and failed, better fall back to default behavior!
            }
        }
        colour = fromLibrary.colour;
    }

    let argumentsNormal = {};
    // TODO: do I need to be limiting only the *args* length, not keywords?
    let argumentsMutation = {
        "@arguments": (args !== null ? args.length : 0) +
            (keywords !== null ? keywords.length : 0),
        "@returns": returns,
        "@parameters": true,
        "@method": isMethod,
        "@name": name,
        "@message": message,
        "@premessage": premessage,
        "@colour": colour,
        "@module": module ?? "",
        "@fromlibrary": fromLibrary?.fullName ?? ""
    };
    // Handle arguments
    let overallI = 0;
    if (args !== null) {
        for (let i = 0; i < args.length; i += 1, overallI += 1) {
            argumentsNormal["ARG" + overallI] = this.convert(args[i], node)
            argumentsMutation["UNKNOWN_ARG:" + overallI] = null
        }
    }
    if (fromLibrary instanceof PythonFunction) {
        for (let i = overallI; i < fromLibrary.parameters.length - fromLibrary.argumentOffset; i += 1) {
            let pythonParameter = fromLibrary.parameters[i + fromLibrary.argumentOffset]
            if (pythonParameter.keyword || pythonParameter.preferKeyword) {
                break
            }

            if (pythonParameter.defaultValue !== "") {
                argumentsNormal["ARG" + i] = this.convertSource("positionalDefaultValue.py", "\n".repeat(node.lineno - 1) + "p=" + pythonParameter.defaultValue).rawXml.children[0].children['VALUE']?.children[0]
            }
            argumentsMutation["UNKNOWN_ARG:" + i] = null
            overallI += 1
        }
    }
    let foundKeywords = new Set();
    if (keywords !== null) {
        for (let i = 0; i < keywords.length; i += 1, overallI += 1) {
            let keyword = keywords[i];
            let arg = keyword.arg;
            let value = keyword.value;
            if (arg === null) {
                argumentsNormal["ARG" + overallI] = this.convert(value, node);
                argumentsMutation["KWARGS:" + overallI] = null;
            } else {
                argumentsNormal["ARG" + overallI] = this.convert(value, node);
                let keywordName = Sk.ffi.remapToJs(arg)
                argumentsMutation["KEYWORD:" + keywordName] = null;
                foundKeywords.add(keywordName)
            }
        }
    }
    if (fromLibrary instanceof PythonFunction) {
        for (let i = overallI - foundKeywords.size; i < fromLibrary.parameters.length - fromLibrary.argumentOffset; i += 1) {
            let pythonParameter = fromLibrary.parameters[i + fromLibrary.argumentOffset]
            if (!(pythonParameter.keyword || pythonParameter.preferKeyword) || foundKeywords.has(pythonParameter.name)) {
                continue
            }

            if (pythonParameter.variableLength) {
                continue
            }

            if (pythonParameter.defaultValue !== "") {
                argumentsNormal["ARG" + overallI] = this.convertSource("keywordDefaultValue.py", "\n".repeat(node.lineno - 1) + "k=" + pythonParameter.defaultValue).rawXml.children[0].children['VALUE'].children[0]
            }
            argumentsMutation["KEYWORD:" + pythonParameter.name] = null
            overallI += 1
        }
    }

    if (isMethod) {
        argumentsNormal['FUNC'] = this.convert(caller, node);
    }

    // Build actual block
    let newBlock = BlockMirrorTextToBlocks.create_block("ast_Call", node.lineno,
        {}, argumentsNormal, {inline: true}, argumentsMutation);

    if (fromLibrary instanceof PythonFunction) {
        fromLibrary.applyShadow(newBlock)
    }

    if (returns === 'None' || this.isStatementContainer(parent)) {
        // Return as statement
        return [newBlock];
    } else {
        // Return as expression
        return newBlock;
    }
};
