function _resolve_colour(colour) {
  if (typeof colour === "string" && typeof BlockMirrorTextToBlocks === "function") {
    return BlockMirrorTextToBlocks.COLOR[colour]
  }
  return colour
}

class PythonModule {
  static isA(fullName) {
    return (
      /^([a-z][a-zA-Z0-9_]*)(\.[a-z][a-zA-Z0-9_]*)*$/.test(fullName)
    );
  }

  static extractName(signature) {
    if (signature.startsWith('class ')) {
      if (!signature.includes('.')) {
        return "";
      }

      signature = signature.substr(6);
    }

    let moduleName = signature.split(/\.([A-Z][^.]*)\.?.+$/, 1)[0];

    if (PythonModule.isA(moduleName)) {
      return moduleName;
    }

    return "";
  }

  addMember(signature, inputObject) {
    const [code, comment] = signature.split("//", 2);
    let member;

    if (PythonFunction.isA(code)) {
      member = new PythonFunction(
          this,
          code,
          comment,
          inputObject?.colour ?? inputObject?.color,
      );

      for (let alias of member.aliases) {
        this.members.set(alias.name, alias);
      }
    } else {
      member = new PythonAttribute(
          this,
          code,
          comment,
          inputObject?.colour ?? inputObject?.color,
      );
    }

    this.members.set(member.name, member);
  }

  constructor(library, signature, comment, members) {
    this.library = library;
    [this.fullName, this.name] = signature.split(" as ", 2);
    if (!this.name) {
      this.name = this.fullName.substring(this.fullName.lastIndexOf(".") + 1);
    }
    this.requiresImport = this.fullName === "" ? "" : this.name === this.fullName ? this.fullName : (this.fullName + " as " + this.name);
    this.members = new Map();

    if (members !== undefined) {
      for (let input of members) {
        if (typeof input === "object") {
          if (input.signatures) {
            for (const signature of input.signatures) {
              this.addMember(signature, input)
            }
          } else {
            this.addMember(input.signature, input)
          }
        } else {
          this.addMember(input)
        }
      }
    }
  }

  toString() {
    return this.requiresImport;
  }

  toToolbox(textToBlocks) {
    let result = "";

    let originalImports = textToBlocks.imports
    try {
      textToBlocks.imports = new TypeRegistry()
      textToBlocks.imports.set(this.fullName, this.name)
      for (let value of this.members.values()) {
        result += value.toToolbox(textToBlocks) + "<sep></sep>";
      }
    } finally {
      textToBlocks.imports = originalImports
    }
    return result;
  }

  resolve(name) {
    if (name === this.fullName) {
      return this;
    }

    let memberName;

    if (name.startsWith(this.fullName + ".") && this.fullName !== "") {
      memberName = name.substring(this.fullName.length + 1);
    } else {
      memberName = name;
    }

    let indexOfDot = memberName.indexOf(".");

    if (indexOfDot === -1) {
      return this.members.get(memberName);
    }

    if (this.fullName === "" && indexOfDot === 0) {
      // Special case, look for a method in all builtin classes
      let methodName = memberName.substring(1);

      for (let member of this.members.values()) {
        if (member instanceof PythonClass) {
          let result = member.resolve(methodName)

          if (result) {
            return result
          }
        }
      }

      return null;
    }

    return this.members.get(memberName.substring(0, indexOfDot))?.resolve(
      memberName.substring(indexOfDot + 1),
    );
  }

  registerImports(typeRegistry) {
    typeRegistry.set(this.fullName, this.name)

    for (const member of this.members.values()) {
      if (member instanceof PythonClass) {
        typeRegistry.set(member.fullName, member.name)
      }
    }
  }
}

class PythonParameter {
  constructor(parameter, arg, positional, keyword) {
    this.positional = positional;
    this.keyword = keyword;

    if (parameter.startsWith("*")) {
      this.variableLength = true;

      if (parameter.startsWith("**")) {
        parameter = parameter.substring(2);
        this.keyword = true;
        this.positional = false;
      } else {
        parameter = parameter.substring(1);
        this.keyword = false;
        this.positional = true;
      }
    } else {
      this.variableLength = false;
    }
    let [nameAndTypeHint, defaultValue] = parameter.split("=", 2);
    let [name, typeHint] = nameAndTypeHint.split(":", 2);
    this.name = name.trim();
    this.typeHint = (typeHint ?? "").trim();

    // Convert double quotes to single quotes for default string values
    this.defaultValue = (defaultValue ?? "").trim().replace(/^"([^"]*)"$/, "'$1'");
    this.preferKeyword = this.positional && this.keyword

    if (arg.includes("=")) {
      let [message, value] = arg.split("=", 2);
      this.message = message.trim();
      this.value = value.trim();
    } else {
      this.message = this.name;
      this.value = arg.trim();

      if (this.value !== "") {
        this.preferKeyword = false
      }
    }

    if (this.value === python.pythonGenerator.blank) {
      // For consistency
      this.value = ""
    }
  }

  toPythonSource() {
    if (this.variableLength && this.keyword) {
      return ""
    }

    let processedValue = this.value

    if (this.value === "") {
      if (this.defaultValue === "" && !(this.variableLength && this.positional)) {
        processedValue = python.pythonGenerator.blank;
      } else {
        processedValue = this.defaultValue
      }
    }

    if (this.positional && (!this.keyword || !this.preferKeyword)) {
      // Positional only or preferred
      return processedValue;
    }
    return `${this.name} = ${processedValue}`;
  }

  #replaceTagName(element, tagName) {
    if (element.tagName === tagName) {
      return
    }

    let replacementElement = document.createElement(tagName);

    for (let i = 0, l = element.attributes.length; i < l; ++i) {
      let nodeName = element.attributes.item(i).nodeName;
      let nodeValue = element.attributes.item(i).nodeValue;
      replacementElement.setAttribute(nodeName, nodeValue);
    }

    replacementElement.innerHTML = element.innerHTML;
    element.parentNode.replaceChild(replacementElement, element);
  };

  #matchesDefaultValue(type, value) {
    if (this.defaultValue === "") {
      return value === ""
    }

    switch (type) {
      case "ast_NameConstantBoolean":
        return this.defaultValue === value || this.defaultValue === "True" && value === "TRUE" || this.defaultValue === "False" && value === "FALSE"
      case "ast_NameConstantNone":
        return this.defaultValue === "None"
      case "ast_Name":
      case "ast_Str":
      case "ast_StrChar":
        return this.defaultValue === value
      case "ast_Num":
      case "ast_UnaryOpUSub":
        return parseFloat(this.defaultValue) === parseFloat(value)
    }
    return false
  }

  #shouldShadow(argBlock) {
    if (this.defaultValue === '') {
      return false
    } else if (argBlock instanceof HTMLElement) {
      // Blockly XML
      let blockElement = argBlock.firstElementChild;
      let blockType = blockElement.getAttribute("type")
      let value = blockElement.textContent

      if (blockType === "ast_UnaryOpUSub") {
        value = "-" + value
      } else if (blockType === "ast_Str" || blockType === "ast_StrChar") {
        value = "'" + value.replace("'", "\'").replace('\n', '\\n') + "'"
      }

      return this.#matchesDefaultValue(blockType, value)
    } else {
      // Blockly block
      return this.#matchesDefaultValue(argBlock.type, python.pythonGenerator.descrub_(python.pythonGenerator.blockToCode(argBlock)[0]))
    }
  }

  applyShadow(argBlock) {
    if (argBlock) {
      let shouldShadow = this.#shouldShadow(argBlock)

      if (argBlock instanceof HTMLElement) {
        // Blockly XML
        for (let childElement of [...argBlock.getElementsByTagName(shouldShadow ? 'block' : 'shadow')].reverse()) {
          this.#replaceTagName(childElement, shouldShadow ? 'shadow' : 'block')
        }
      } else if (argBlock.shadow !== shouldShadow) {
        // Blockly block
        argBlock.shadow = shouldShadow
        argBlock.setStyle(argBlock.getStyleName()) // Re-apply the style

        for (let child of argBlock.getChildren()) {
          argBlock.shadow = shouldShadow
          argBlock.setStyle(argBlock.getStyleName()) // Re-apply the style
        }
      }
    }
  }
}

class PythonParameters extends Array {
  constructor(signature, comment) {
    super();
    const parameters = signature
      .substring(signature.lastIndexOf("(") + 1, signature.lastIndexOf(")"))
      .trim();

    if (parameters !== "") {
      const args = comment.substring(
        comment.lastIndexOf("(") + 1,
        comment.lastIndexOf(")"),
      );
      const argParts = args.split(/(?<!\[[^\]]*),/).map((value) => {
        return value.trim();
      });
      const parameterParts = parameters.split(/(?<!\[[^\]]*),/).map((value) => {
        return value.trim();
      });

      // PEP 570 Python Positional-Only Parameters
      let positional = true;
      let keyword = !parameterParts.includes("/");
      let argIndex = 0;

      for (const parameter of parameterParts) {
        if (parameter === "/") {
          keyword = true;
        } else if (parameter === "*") {
          positional = false;
        } else {
          let isSelfOrCls = argIndex === 0 && (parameter === "self" || parameter === "cls")
          this.push(
            new PythonParameter(
              parameter,
          isSelfOrCls ? "" : (argParts[argIndex] ?? ""),
              positional,
              keyword,
            ),
          );

          if (parameter.length > 1 && parameter[0] === '*' && parameter[1] !== '*') {
            // No positional arguments after *args
            positional = false;
          }

          if (!isSelfOrCls) {
            argIndex++;
          }
        }
      }

      // Any parameter before *args should not be addressable by keyword
      let positionalOnly = false

      for (let i = this.length - 1; i >= 0; i--) {
        let parameter = this[i]

        if (positionalOnly) {
          parameter.keyword = false
        }

        positionalOnly = positionalOnly || (parameter.variableLength && parameter.positional)
      }
    }
  }

  toPythonSource() {
    return [
      ...this.entries()
        .filter(([key, value]) => !(key === 0 && (value.name === "self" || value.name === "cls")))
        .map(([, value]) => value.toPythonSource()),
    ]
      .filter((result) => result !== "")
      .join(", ");
  }

  findByKeyword(keyword) {
    return this.values().find((value) => value.name === keyword);
  }
}

function splitPremessageMessage(toSplit) {
  let [premessage, message] = toSplit.trim().split("{}", 2);

  if (message === undefined) {
    return ["", premessage];
  }
  return [premessage, message];
}

function splitPremessageMessagePostmessage(toSplit) {
  let [premessage, message, postmessage] = toSplit.trim().split("{}", 3);

  if (message === undefined) {
    return ["", premessage, ""];
  } else if (postmessage === undefined) {
    return [premessage, message, ""];
  }
  return [premessage, message, postmessage];
}

class PythonFunction {
  static isA(signature) {
    return signature.includes("(");
  }

  constructor(pythonModule, signature, comment, colour) {
    this.pythonModule = pythonModule;
    let indexOfTypeHint = signature.indexOf(":", signature.indexOf(")") + 1);
    this.typeHint =
        indexOfTypeHint < 0
            ? ""
            : signature.substring(indexOfTypeHint + 1).trim();
    let names = signature.substring(0, signature.indexOf("("));
    const [name, ...aliases] = names.split(" ");
    this.name = name;

    if ((comment ?? "").trim() === "") {
      this.premessage = "";
      this.message = this.name;
    } else {
      let indexOfOpening = comment.indexOf("(");
      let beforeOpening =
          indexOfOpening === -1 ? comment : comment.substring(0, indexOfOpening);
      [this.premessage, this.message] = splitPremessageMessage(beforeOpening);
    }

    this.parameters = new PythonParameters(signature, comment ?? "");
    this.fullName = pythonModule.fullName === "" ? this.name : (pythonModule.fullName + "." + this.name);
    this.isAlias = false;

    this.aliases = aliases.map((value) => {
      // Should be better, but does not seem to preserve methods in the current toolchain:
      // let result = structuredClone(this)
      // result.name = value
      let result = new PythonFunction(
        pythonModule,
        value + signature.substring(signature.indexOf("(")),
        comment,
      );
      result.premessage = this.premessage;
      result.message = this.message;
      result.isAlias = true;
      return result;
    });

    this.colour = _resolve_colour(colour) ?? pythonModule.library.colour;
    this.argumentOffset = 0
  }

  toPythonSource() {
    let modulePrefix =
      this.pythonModule.fullName === "" ? "" : this.pythonModule.name + ".";
    return (
      modulePrefix +
      this.name +
      "(" +
      this.parameters.toPythonSource() +
      ")"
    );
  }

  toString() {
    return this.toPythonSource();
  }

  applyShadow(block) {
    if (block instanceof HTMLElement) {
      let mutationElement = block.firstElementChild
      let blockChildren = block.children

      for (let i = 0; i < mutationElement.children.length; i++) {
        let valueElement = blockChildren['ARG' + i]

        if (!valueElement) {
          continue
        }

        let mutation = mutationElement.children[i].getAttribute('name')

        if (mutation.startsWith('KEYWORD:')) {
          this.parameters.findByKeyword(mutation.substring(8))?.applyShadow(valueElement);
        } else {
          this.parameters[i + this.argumentOffset]?.applyShadow(valueElement);
        }
      }
    } else {
      for (let i = 0; i < block.arguments_.length; i++) {
        let mutation = block.arguments_[i]
        let argBlock = block.getInputTargetBlock('ARG' + i);

        if (mutation.startsWith('KEYWORD:')) {
          this.parameters.findByKeyword(mutation.substring(8))?.applyShadow(argBlock);
        } else {
          this.parameters[i + this.argumentOffset]?.applyShadow(argBlock);
        }
      }
    }
  }

  toToolboxBlock(textToBlocks) {
    let pythonSource = this.toPythonSource();
    let result = textToBlocks.convertSource("toolbox.py", pythonSource);
    let blockElement = result.rawXml.children[0];

    // if (!!this.typeHint) {
    //   blockElement.setAttribute("returns", this.typeHint);
    // }
    //
    // // TODO tooltip does not seem to show up
    // blockElement.setAttribute("tooltip", pythonSource);
    return blockElement;
  }

  toToolbox(textToBlocks) {
    if (this.isAlias) {
      return "";
    }

    let toolboxBlock = this.toToolboxBlock(textToBlocks)
    this.applyShadow(toolboxBlock)

    return (
        toolboxBlock.parentNode.innerHTML.toString() + "\n"
    );
  }
}

class PythonClass {
  static isA(signature) {
    return signature.startsWith("class ");
  }

  addMember(signature, inputObject) {
    let member;
    const [code, comment] = signature.split("//", 2);

    if (PythonFunction.isA(code)) {
      if (PythonConstructorMethod.isA(code)) {
        member = new PythonConstructorMethod(
            this,
            code,
            comment,
            inputObject?.colour ?? inputObject?.color,
        );
        this.colour = member.colour;
      } else {
        member = new PythonMethod(
            this,
            code,
            comment,
            inputObject?.colour ?? inputObject?.color,
        );

        for (let alias of member.aliases) {
          this.members.set(alias.name, alias);
        }
      }
    } else {
      member = new PythonAttribute(
          this,
          code,
          comment,
          inputObject?.colour ?? inputObject?.color,
      );
    }

    this.members.set(member.name, member);
  }

  constructor(pythonModule, signature, comment, members) {
    this.module = pythonModule;
    let endOfSimpleName = signature.indexOf("(")

    if (endOfSimpleName === -1) {
      endOfSimpleName = signature.length
      this.baseClass = "object"
    } else {
      this.baseClass = signature.substring(endOfSimpleName + 1, signature.indexOf(")")).trim()
    }

    let startOfSimpleName = signature.lastIndexOf(".", endOfSimpleName) + 1

    if (startOfSimpleName === 0 && signature.startsWith("class ")) {
      startOfSimpleName = 6
    }

    this.name = signature.substring(startOfSimpleName, endOfSimpleName);

    if (this.name === this.baseClass) {
      this.baseClass = ""
    }

    if (pythonModule.fullName === "") {
      this.fullName = this.name;
      this.requiresImport = "";
    } else {
      this.fullName = pythonModule.fullName + "." + this.name;
      this.requiresImport = this.fullName === this.name ? this.name: this.fullName + " as " + this.name;
    }

    this.colour = pythonModule.library.colour;
    this.members = new Map();

    // Default constructor
    this.members.set("__init__", new PythonConstructorMethod(
        this,
        "__init__()",
        "",
        null,
    ));

    for (let input of members) {
      if (typeof input === "object") {
        if (input.signatures) {
          for (const signature of input.signatures) {
            this.addMember(signature, input)
          }
        } else {
          this.addMember(input.signature, input)
        }
      } else {
        this.addMember(input)
      }
    }
  }

  toString() {
    return this.requiresImport;
  }

  toToolbox(textToBlocks) {
    let result = "";

    let originalImports = textToBlocks.imports
    try {
      textToBlocks.imports = new TypeRegistry()
      textToBlocks.imports.set(this.fullName, this.name)

      for (const member of this.members.values()) {
        result += member.toToolbox(textToBlocks);
      }
    } finally {
      textToBlocks.imports = originalImports
    }

    return result;
  }

  resolve(name) {
    if (name === this.fullName || name === this.name) {
      return this;
    }

    let memberName;

    if (name.startsWith(this.fullName + ".")) {
      memberName = name.substring(this.fullName.length + 1);
    } else if (name.startsWith(this.name + ".")) {
      memberName = name.substring(this.name.length + 1);
    } else {
      memberName = name;
    }

    let indexOfDot = memberName.indexOf("(");
    let result = this.members.get(
      indexOfDot === -1 ? memberName : memberName.substring(0, indexOfDot)
    );

    if (!result && this.baseClass !== "") {
      result = this.module.library.libraries.resolve(this.baseClass + "." + memberName);
    }

    return result
  }
}

class PythonAttribute {
  static isA(signature) {
    return !signature.includes("(");
  }

  constructor(pythonClassOrModule, signature, comment, colour) {
    this.pythonClassOrModule = pythonClassOrModule;
    let indexOfTypeHint = signature.lastIndexOf(":");
    this.typeHint =
      indexOfTypeHint < 0
        ? ""
        : signature.substring(indexOfTypeHint + 1).trim();
    this.name = signature
      .substring(0, indexOfTypeHint || signature.length)
      .trim();
    this.colour = _resolve_colour(colour) ?? pythonClassOrModule.colour;

    if ((comment ?? "").trim() === "") {
      if (pythonClassOrModule instanceof PythonClass) {
        this.premessage = pythonClassOrModule.name;
      } else {
        this.premessage = ""
      }
      this.message = "."
      this.postmessage = ""
    } else {
      [this.premessage, this.message, this.postmessage] = splitPremessageMessagePostmessage(comment);
    }
  }

  toPythonSource() {
    if (this.pythonClassOrModule instanceof PythonClass) {
      return python.pythonGenerator.blank + "." + this.name;
    }
    return this.pythonClassOrModule.name + "." + this.name;
  }

  toString() {
    return this.toPythonSource();
  }

  toToolboxBlock(textToBlocks) {
    let blockElement
    if (this.pythonClassOrModule instanceof PythonClass) {
      let originalVariables = textToBlocks.variables
      try {
        textToBlocks.variables = new TypesRegistry()
        textToBlocks.variables.add(this.pythonClassOrModule.fullName, python.pythonGenerator.blank)
        let result = textToBlocks.convertSource(
            "toolbox.py",
            this.toPythonSource(),
        );
        blockElement = result.rawXml.children[0];
      } finally {
        textToBlocks.variables = originalVariables
      }
    } else {
      let result = textToBlocks.convertSource(
          "toolbox.py",
          this.toPythonSource(),
      );
      blockElement = result.rawXml.children[0];
    }


    // for (let index = blockElement.children.length - 1; index >= 0; index--) {
    //   let child = blockElement.children[index];
    //
    //   if (child.localName === "value") {
    //     child.innerHTML = "";
    //     // TODO type check, but only possible with JSON, not XML
    //     // child.setAttribute("check", this.pythonClass.fullName)
    //   }
    // }

    if (!!this.typeHint) {
      blockElement.setAttribute("output", this.typeHint);
    }
    return blockElement;
  }

  toToolbox(textToBlocks) {
    return (
      this.toToolboxBlock(textToBlocks).parentNode.innerHTML.toString() + "\n"
    );
  }
}

class PythonMethod extends PythonFunction {
  constructor(pythonClass, signature, comment, colour) {
    super(pythonClass.module, signature, comment, colour);
    this.pythonClass = pythonClass;
    this.fullName = pythonClass.fullName + "." + this.name;

    if ((comment ?? "").trim() === "") {
      this.message = "." + this.name;
    }

    if (this.parameters.length === 0) {
      this.staticmethod = true
      this.classmethod = false
    } else if (this.parameters[0].name === 'self') {
      this.staticmethod = false
      this.classmethod = false
    } else if (this.parameters[0].name === 'cls') {
      this.staticmethod = false
      this.classmethod = true
    } else {
      this.staticmethod = true
      this.classmethod = false
    }

    if (this.premessage === "" && !(this.classmethod || this.staticmethod)) {
      this.premessage = pythonClass.name;
    }

    this.argumentOffset = this.staticmethod ? 0 : 1
  }

  toPythonSource() {
    if (this.staticmethod || this.classmethod) {
      return (
          this.pythonClass.fullName + "." +
          this.name +
          "(" +
          this.parameters.toPythonSource() +
          ")"
      );
    }
    return (
        python.pythonGenerator.blank +
        "." +
        this.name +
        "(" +
        this.parameters.toPythonSource() +
        ")"
    );
  }

  toToolboxBlock(textToBlocks) {
      let originalVariables = textToBlocks.variables
      let blockElement
      try {
        textToBlocks.variables = new TypesRegistry()
        textToBlocks.variables.add(this.pythonClass.fullName, python.pythonGenerator.blank)
        blockElement = super.toToolboxBlock(textToBlocks);
      } finally {
        textToBlocks.variables = originalVariables
      }

      // TODO this can probably eventually be done cleaner
      // if (!!this.pythonClass.requiresImport) {
      //   blockElement.children['FUNC'].setAttribute(
      //     "module",
      //     this.pythonClass.requiresImport,
      //   );
      // }

      return blockElement
    }
}

class PythonConstructorMethod extends PythonMethod {
  static isA(signature) {
    return /^__init__\(\s*self\s*[,)]\s*/.test(signature);
  }

  constructor(pythonClass, signature, comment, colour) {
    super(pythonClass, signature, comment, colour);
    this.typeHint = pythonClass.fullName;

    if ((comment ?? "").trim() === "") {
      this.message = this.pythonClass.name
    }
  }

  toPythonSource() {
    return (
      this.pythonClass.name +
      "(" +
      this.parameters.toPythonSource() +
      ")"
    );
  }
}

class Library {
  constructor(name, libraryConfiguration, libraries) {
    this.name = name;
    this.libraries = libraries;
    this.modules = new Map();
    this.colour = libraries.defaultColor
    this.toolbox = null;
    let classes = [];

    for (let classOrModuleDef in libraryConfiguration) {
      const [name, comment] = classOrModuleDef.split("//", 2);

      if (name.startsWith("__")) {
        // Library metadata
        if (name === "__colour" || name === "__color") {
          this.colour = _resolve_colour(libraryConfiguration[name])
        } else if (name === "__toolbox") {
          this.toolbox = libraryConfiguration[name];
        }
      } else if (PythonClass.isA(name)) {
        classes.push(classOrModuleDef);
      } else {
        let members = libraryConfiguration[classOrModuleDef]

        if (members.some(member => PythonConstructorMethod.isA(member))) {
          classes.push(classOrModuleDef);
        } else {
          let module = new PythonModule(
              this,
              name,
              comment,
              members,
          )
          this.modules.set(module.fullName, module);
        }
      }
    }

    for (let classDef of classes) {
      const [signature, comment] = classDef.split("//", 2);
      let moduleName = PythonModule.extractName(signature);
      let pythonModule = this.modules.get(moduleName);

      if (!pythonModule) {
        pythonModule = new PythonModule(this, moduleName);
        this.modules.set(moduleName, pythonModule);
      }

      let pythonClass = new PythonClass(
        pythonModule,
        signature,
        comment,
        libraryConfiguration[classDef],
      );
      pythonModule.members.set(pythonClass.name, pythonClass);
    }
  }

  _shouldShowToolbox(imports) {
    if (this.toolbox === false || this.toolbox === true) {
      return this.toolbox;
    }

    if (imports) {
      for (const importedType of imports.types()) {
        for (const module of this.modules.values()) {
          if (module.resolve(importedType) !== null) {
            return true;
          }
        }
      }

      return false;
    }

    return true;
  }

  toToolbox(textToBlocks) {
    if (!this._shouldShowToolbox(textToBlocks.imports)) {
      return "";
    }

    let categoryXml = `<category name="${this.name}">`; // TODO color

    for (const module of this.modules.values()) {
      categoryXml += module.toToolbox(textToBlocks);
    }

    categoryXml += "</category>";
    return categoryXml;
  }

  registerImports(typeRegistry) {
    for (const module of this.modules.values()) {
      if (module.fullName === "") {
        continue
      }

      module.registerImports(typeRegistry)
    }
  }
}

class Libraries extends Map {
  constructor(librariesConfiguration) {
    super()
    this.defaultColor = _resolve_colour("FUNCTIONS")
    for (let name in librariesConfiguration) {
      this.set(name, new Library(name, librariesConfiguration[name], this))
    }
  }

  findModulesByName(moduleName) {
    return this.values()
      .map((library) => library.modules.get(moduleName))
      .filter((module) => module).toArray();
  }

  toToolbox(textToBlocks) {
    let result = "";
    for (const library of this.values()) {
      result += library.toToolbox(textToBlocks);
    }
    return result;
  }

  resolve(fullName) {
    let moduleName = PythonModule.extractName(fullName);
    let foundModules = this.findModulesByName(moduleName);

    if (!foundModules.length && moduleName.includes('.')) {
      // Last part may be an attribute
      foundModules = this.findModulesByName(moduleName.substring(0, moduleName.lastIndexOf('.')));
    }

    if (!foundModules.length) {
      // Might not contain a module name, check the built-ins
      foundModules = this.findModulesByName('');
    }

    for (let foundModule of foundModules) {
      let found = foundModule.resolve(fullName);

      if (found) {
        return found;
      }
    }

    return null;
  }

  registerImports(typeRegistry) {
    for (const library of this.values()) {
      library.registerImports(typeRegistry)
    }
  }
}

if (typeof module !== 'undefined') {
  module.exports = {Libraries, Library, PythonModule, PythonClass, PythonFunction, PythonAttribute};
}
