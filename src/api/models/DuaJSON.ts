export class DuaJSON {
    public name: string;
    public germanName: string;
    public germanTextIdentifier: string;
    public arabicTextIdentifier: string;
    public transliterationTextIdentifier: string;
    public lines: Array<{}>;

    constructor(json) {
        console.log(json);
        this.name = json['name'];
        this.germanName = json['germanName'];
        this.germanTextIdentifier = json['germanTextIdentifier'];
        this.arabicTextIdentifier = json['arabicTextIdentifier'];
        this.transliterationTextIdentifier = json['transliterationTextIdentifier'];
        this.lines = json['lines'];

        console.log([
            this.name,
            this.germanName,
            this.germanTextIdentifier,
            this.arabicTextIdentifier,
            this.transliterationTextIdentifier,
            this.lines
        ]);
    }
}