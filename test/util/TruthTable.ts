import * as RDF from 'rdf-js';

import { evaluate } from '../../util/Util';

/*
 * Maps short strings to longer RDF term-literals for easy use in making
 * evaluation tables.
 * Ex: { 'true': '"true"^^xsd:boolean' }
 */
export interface IAliasMap { [key: string]: string; }

/*
 * Maps short strings to longer RDF term-objects for easy use in making
 * evaluation tables.
 * Ex: { 'true': RDFDM.literal("true", RDF.namedNode(DT.XSD_BOOLEAN))}
 */
export interface IResultMap { [key: string]: RDF.Term; }

/*
 * A series of tests in string format.
 * A difference is made between erroring and non-erroring tests-cases because
 * the testing framework requires it, and it allows for some reduction in
 * boilerplate when errorhandling is similar between operators.
 * Some mappings are passed to translate between shorthand aliases and their
 * full SPARQL representations.
 *
 * It's format is
 *  - line separation between rows (= test cases)
 *  - space separation between args
 *  - '=' separation between the args and the result
 *
 * Ex: `
 * true true = false
 * false false = false
 * `
 */
export interface IEvaluationTable {
  operator: string;
  table: string;
  errorTable: string;
  aliasMap: IAliasMap;
  resultMap: IResultMap;
}

/*
 * Given the definition for an evaluation table, test all it's test cases.
 */
export function testTable(definition: IEvaluationTable, arity: number): void {
  const tTable = (arity === 2)
    ? new BinaryTable(definition, BinaryTableParser)
    : new UnaryTable(definition, UnaryTableParser);

  tTable.test();
}

// -----------------------------------------------------------------------------
// Internals
// -----------------------------------------------------------------------------

type Row = [string, string, string] | [string, string];

abstract class Table<RowType extends Row> {
  protected parser: TableParser<RowType>;
  protected def: IEvaluationTable;

  constructor(def: IEvaluationTable, parser: IParserConstructor<RowType>) {
    this.def = def;
    this.parser = new parser(def.table, def.errorTable);
  }

  public abstract test(): void;
}

class BinaryTable extends Table<[string, string, string]> {
  public test(): void {
    this.parser.table.forEach((row) => {
      const [left, right, result] = row;
      const { aliasMap, resultMap, operator } = this.def;
      const expr = `${aliasMap[left]} ${operator} ${aliasMap[right]}`;

      it(`(${left} ${operator} ${right}) should evaluate ${result}`, () => {
        expect(evaluate(expr)).toBe(resultMap[result]);
      });
    });

    this.parser.errorTable.forEach((row) => {
      const [left, right, error] = row;
      const { aliasMap, operator } = this.def;
      const expr = `${aliasMap[left]} ${operator} ${aliasMap[right]}`;

      it(`(${left}, ${right}) should error`, () => {
        expect(() => evaluate(expr)).toThrow();
      });
    });
  }
}

class UnaryTable extends Table<[string, string]> {
  public test(): void {
    this.parser.table.forEach((row) => {
      const [arg, result] = row;
      const { aliasMap, operator, resultMap } = this.def;
      const expr = `${operator} ${aliasMap[arg]}`;

      it(`(${arg}) should evaluate ${result}`, () => {
        expect(evaluate(expr)).toBe(resultMap[arg]);
      });
    });

    this.parser.errorTable.forEach((row) => {
      const [arg, error] = row;
      const { aliasMap, operator } = this.def;
      const expr = `${operator} ${aliasMap[arg]}`;

      it(`(${arg}) should error`, () => {
        expect(() => evaluate(expr)).toThrow();
      });
    });
  }
}

interface IParserConstructor<RowType extends Row> {
  new(table: string, errorTable: string): TableParser<RowType>;
}

abstract class TableParser<RowType extends Row> {
  public table: RowType[];
  public errorTable: RowType[];

  constructor(table: string, errTable: string) {
    this.table = this.splitTable(table).map((row) => this.parseRow(row));
    this.errorTable = this.splitTable(errTable).map((r) => this.parseRow(r));
  }

  protected abstract parseRow(row: string): RowType;

  private splitTable(table: string): string[] {
    // Trim whitespace, and remove blank lines
    table = table.trim().replace(/^\s*[\r\n]/gm, '');
    return table.split('\n');
  }
}

class BinaryTableParser extends TableParser<[string, string, string]> {
  protected parseRow(row: string): [string, string, string] {
    row = row.trim().replace(/  +/g, ' ');
    const [left, right, _, result] = row.split(' ');
    return [left, right, result];
  }
}

class UnaryTableParser extends TableParser<[string, string]> {
  protected parseRow(row: string): [string, string] {
    // Trim whitespace and remove double spaces
    row = row.trim().replace(/  +/g, ' ');
    const [arg, _, result] = row.split(' ');
    return [arg, result];
  }
}