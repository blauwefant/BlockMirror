const path = require('path');
const fs = require('fs')

python = {}
python.pythonGenerator = {}
python.pythonGenerator.blank = '___'
const blockMirrorLibraries = require('./src/libraries.js');

let baseDir = path.resolve(process.argv.length > 2 ? process.argv[2] : __dirname)
let librariesDir = path.resolve(baseDir, 'src/libraries/')
let librariesConfig = {}

function addMemberToTranslationsMap(member, translationsMap) {
    if (member instanceof blockMirrorLibraries.PythonFunction && !member.isAliasOf) {
      let key, value, premessage;

      if (member.premessage && (!member.pythonClass || member.premessage !== member.pythonClass.name)) {
        premessage = member.premessage.trimEnd() + ' '
      } else {
        premessage = "";
      }

      if (member instanceof blockMirrorLibraries.PythonConstructorMethod) {
        key = member.pythonClass.fullName;
        value = `${premessage}${member.message}${member.label}${member.postmessage}`;
      } else {
        key = member.fullName;

        if (member.labels.length > 1) {
          labelsPart = "{" + member.labels.join(" | ") + "}";
        } else {
          labelsPart = member.labels[0];
        }

        if (member instanceof blockMirrorLibraries.PythonMethod) {
          value = `${premessage}{}${member.message}${labelsPart}${member.postmessage}`;
        } else if (member.pythonModule.fullName === "") {
          value = `${member.premessage}${member.message}${labelsPart}${member.postmessage}`;
        } else {
          value = `${premessage}{}${member.message}${labelsPart}${member.postmessage}`;
        }
      }
      translationsMap.set(key, value);
    } else if (member instanceof blockMirrorLibraries.PythonAttribute && !member.isAliasOf) {
      let premessage, value, labelsPart;

      if (member.labels.length > 1) {
        labelsPart = "{" + member.labels.join(" | ") + "}";
      } else {
        labelsPart = member.labels[0];
      }

      if (member.premessage && (!member.pythonClass || member.premessage !== member.pythonClass.name)) {
        premessage = member.premessage + " ";
      } else {
        premessage = "";
      }

      if (!!member.pythonClass || member.pythonModule.fullName !== "") {
        value = `${premessage}{}${member.message}${labelsPart}${member.postmessage}`;
        translationsMap.set(member.fullName, value);
      }
    }
}

fs.readdirSync(librariesDir, {recursive: true}).forEach(file => {
    if (file.endsWith(".json")) {
        let libraryName = file.substring(0, file.length -5).replace('/', ' ');
        let libraryValue = fs.readFileSync(path.resolve(librariesDir, file), 'utf8')
        librariesConfig[libraryName] = JSON.parse(libraryValue)
    }
});

let libraries = new blockMirrorLibraries.Libraries(librariesConfig)
let libraryTranslationsMap = new Map()

for (const library of libraries.values()) {
    let libraryPrefix = library.name.split(" ", 1)[0]
    let translationsMap = libraryTranslationsMap.get(libraryPrefix) || new Map()

    for (const module of library.modules.values()) {
        for (const member of module.members.values()) {
            if (member instanceof blockMirrorLibraries.PythonClass) {
                for (const member2 of member.members.values()) {
                    addMemberToTranslationsMap(member2, translationsMap);
                }
            } else {
                addMemberToTranslationsMap(member, translationsMap);
            }
        }
    }

    libraryTranslationsMap.set(libraryPrefix, translationsMap)
}

for (let [libraryName, translationsMap] of libraryTranslationsMap) {
    translationsMap = new Map([...translationsMap.entries()].sort());
    let potData = "# BlockMirror library " + libraryName + " gettext portable object template\n"
    potData += "# Default English texts are part of the library definitions.\n\n"

    for (const [key, value] of translationsMap) {
        if (/[a-zA-Z]/.test(key)) {
            if (value && value !== key) {
                potData += `#. ${value}\n`
            }
            potData += `msgid "${key.replace('"', '\\"')}"\n`;
            potData += `msgstr ""\n\n`;
        }
    }

    let potDir = path.resolve(baseDir, 'translations/libraries/' + libraryName)
    fs.mkdirSync(potDir, {recursive: true})
    fs.writeFileSync(path.resolve(potDir, 'template.pot'), potData)
}
