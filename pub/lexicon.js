exports.globalLexicon = {
    // keywords
    "let" : { "tk": 0x12, "cls": "keyword" },
    "if" : { "tk": 0x05, "cls": "keyword" },
    "then" : { "tk": 0x06, "cls": "keyword" },
    "else" : { "tk": 0x07, "cls": "keyword" },
    "case" : { "tk": 0x0F, "cls": "keyword" },
    "of" : { "tk": 0x10, "cls": "keyword" },
    "end" : { "tk": 0x11, "cls": "keyword", "length": 0 },
    // booleans
    "true" : { "tk": 0x14, "cls": "val", "length": 0 },
    "false" : { "tk": 0x14, "cls": "val", "length": 0 },
    // functions
    "data" : { "tk": 0x01, "name": "DATA", "cls": "function", "length": 1, "arity": 1 },
}
