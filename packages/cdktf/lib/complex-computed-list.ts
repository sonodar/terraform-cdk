import { IResolvable, Token } from "./tokens";
import {
  IInterpolatingParent,
  ITerraformAddressable,
} from "./terraform-addressable";
import { propertyAccess, Fn } from ".";

abstract class ComplexComputedAttribute implements IInterpolatingParent {
  constructor(
    protected terraformResource: IInterpolatingParent,
    protected terraformAttribute: string
  ) {}

  public getStringAttribute(terraformAttribute: string) {
    return Token.asString(this.interpolationForAttribute(terraformAttribute));
  }

  public getNumberAttribute(terraformAttribute: string) {
    return Token.asNumber(this.interpolationForAttribute(terraformAttribute));
  }

  public getListAttribute(terraformAttribute: string) {
    return Token.asList(this.interpolationForAttribute(terraformAttribute));
  }

  public getBooleanAttribute(terraformAttribute: string): IResolvable {
    return this.interpolationForAttribute(terraformAttribute);
  }

  public getNumberListAttribute(terraformAttribute: string) {
    return Token.asNumberList(
      this.interpolationForAttribute(terraformAttribute)
    );
  }

  public getStringMapAttribute(terraformAttribute: string) {
    return Token.asStringMap(
      this.interpolationForAttribute(terraformAttribute)
    );
  }

  public getNumberMapAttribute(terraformAttribute: string) {
    return Token.asNumberMap(
      this.interpolationForAttribute(terraformAttribute)
    );
  }

  public getBooleanMapAttribute(terraformAttribute: string) {
    return Token.asBooleanMap(
      this.interpolationForAttribute(terraformAttribute)
    );
  }

  public getAnyMapAttribute(terraformAttribute: string) {
    return Token.asAnyMap(this.interpolationForAttribute(terraformAttribute));
  }

  public abstract interpolationForAttribute(terraformAttribute: string): any;
}

export class StringMap implements ITerraformAddressable {
  constructor(
    protected terraformResource: IInterpolatingParent,
    protected terraformAttribute: string
  ) {}

  public lookup(key: string): string {
    return Token.asString(
      this.terraformResource.interpolationForAttribute(
        `${this.terraformAttribute}["${key}"]`
      )
    );
  }

  get fqn(): string {
    return Token.asString(
      this.terraformResource.interpolationForAttribute(this.terraformAttribute)
    );
  }
}

export class NumberMap implements ITerraformAddressable {
  constructor(
    protected terraformResource: IInterpolatingParent,
    protected terraformAttribute: string
  ) {}

  public lookup(key: string): number {
    return Token.asNumber(
      this.terraformResource.interpolationForAttribute(
        `${this.terraformAttribute}["${key}"]`
      )
    );
  }

  get fqn(): string {
    return Token.asString(
      this.terraformResource.interpolationForAttribute(this.terraformAttribute)
    );
  }
}

export class BooleanMap implements ITerraformAddressable {
  constructor(
    protected terraformResource: IInterpolatingParent,
    protected terraformAttribute: string
  ) {}

  public lookup(key: string): IResolvable {
    return this.terraformResource.interpolationForAttribute(
      `${this.terraformAttribute}["${key}"]`
    );
  }

  get fqn(): string {
    return Token.asString(
      this.terraformResource.interpolationForAttribute(this.terraformAttribute)
    );
  }
}

export class AnyMap implements ITerraformAddressable {
  constructor(
    protected terraformResource: IInterpolatingParent,
    protected terraformAttribute: string
  ) {}

  public lookup(key: string): any {
    return Token.asAny(
      this.terraformResource.interpolationForAttribute(
        `${this.terraformAttribute}["${key}"]`
      )
    );
  }

  get fqn(): string {
    return Token.asString(
      this.terraformResource.interpolationForAttribute(this.terraformAttribute)
    );
  }
}

/**
 * @deprecated Going to be replaced by Array of ComplexListItem
 * and will be removed in the future
 */
export class ComplexComputedList extends ComplexComputedAttribute {
  constructor(
    protected terraformResource: IInterpolatingParent,
    protected terraformAttribute: string,
    protected complexComputedListIndex: string,
    protected wrapsSet?: boolean
  ) {
    super(terraformResource, terraformAttribute);
    throw new Error(
      "Version mismatch detected: The provider bindings seem to have been built for an older version of CDKTF. Upgrade your pre-built provider or re-run cdktf get with a more recent version (>= 0.10) of the cdktf-cli."
    );
  }

  public interpolationForAttribute(property: string) {
    if (this.wrapsSet) {
      return propertyAccess(
        Fn.tolist(
          this.terraformResource.interpolationForAttribute(
            this.terraformAttribute
          )
        ),
        [this.complexComputedListIndex, property]
      );
    }

    return this.terraformResource.interpolationForAttribute(
      `${this.terraformAttribute}[${this.complexComputedListIndex}].${property}`
    );
  }
}

export abstract class ComplexList implements ITerraformAddressable {
  constructor(
    protected terraformResource: IInterpolatingParent,
    protected terraformAttribute: string,
    protected wrapsSet: boolean
  ) {}

  get fqn(): string {
    return Token.asString(
      this.terraformResource.interpolationForAttribute(this.terraformAttribute)
    );
  }
}

export abstract class ComplexMap implements ITerraformAddressable {
  constructor(
    protected terraformResource: IInterpolatingParent,
    protected terraformAttribute: string
  ) {}

  get fqn(): string {
    return Token.asString(
      this.terraformResource.interpolationForAttribute(this.terraformAttribute)
    );
  }
}

export class ComplexObject extends ComplexComputedAttribute {
  /**
   * @param terraformResource
   * @param terraformAttribute
   * @param complexObjectIndex the index of the complex object in a list
   * @param complexObjectIsFromSet set to true if this item is from inside a set and needs tolist() for accessing it
   *                               set to "0" for single list items
   */
  constructor(
    protected terraformResource: IInterpolatingParent,
    protected terraformAttribute: string,
    protected complexObjectIsFromSet: boolean,
    protected complexObjectIndex?: number | string
  ) {
    super(terraformResource, terraformAttribute);
  }

  public interpolationForAttribute(property: string) {
    if (this.complexObjectIsFromSet) {
      return propertyAccess(
        Fn.tolist(
          this.terraformResource.interpolationForAttribute(
            this.terraformAttribute
          )
        ),
        [this.complexObjectIndex, property]
      );
    }

    return this.terraformResource.interpolationForAttribute(
      this.complexObjectIndex !== undefined
        ? `${this.terraformAttribute}[${this.complexObjectIndex}].${property}`
        : `${this.terraformAttribute}.${property}`
    );
  }

  protected interpolationAsList() {
    return this.terraformResource.interpolationForAttribute(
      `${this.terraformAttribute}.*`
    );
  }
}

abstract class MapList implements ITerraformAddressable, IInterpolatingParent {
  constructor(
    protected terraformResource: IInterpolatingParent,
    protected terraformAttribute: string,
    protected wrapsSet: boolean
  ) {}

  get fqn(): string {
    return Token.asString(
      this.terraformResource.interpolationForAttribute(this.terraformAttribute)
    );
  }

  interpolationForAttribute(property: string): IResolvable {
    if (this.wrapsSet) {
      const matches = property.match(/\[([^\]]*)\]/); // need to extract out the index
      if (matches) {
        return propertyAccess(
          Fn.tolist(
            this.terraformResource.interpolationForAttribute(
              this.terraformAttribute
            )
          ),
          [matches[1], property]
        );
      }
    }

    return this.terraformResource.interpolationForAttribute(
      `${this.terraformAttribute}${property}`
    );
  }
}

export class StringMapList extends MapList {
  constructor(
    protected terraformResource: IInterpolatingParent,
    protected terraformAttribute: string,
    protected wrapsSet: boolean
  ) {
    super(terraformResource, terraformAttribute, wrapsSet);
  }

  public get(index: number) {
    return new StringMap(this, `[${index}]`);
  }
}

export class NumberMapList extends MapList {
  constructor(
    protected terraformResource: IInterpolatingParent,
    protected terraformAttribute: string,
    protected wrapsSet: boolean
  ) {
    super(terraformResource, terraformAttribute, wrapsSet);
  }

  public get(index: number) {
    return new NumberMap(this, `[${index}]`);
  }
}

export class BooleanMapList extends MapList {
  constructor(
    protected terraformResource: IInterpolatingParent,
    protected terraformAttribute: string,
    protected wrapsSet: boolean
  ) {
    super(terraformResource, terraformAttribute, wrapsSet);
  }

  public get(index: number) {
    return new BooleanMap(this, `[${index}]`);
  }
}

export class AnyMapList extends MapList {
  constructor(
    protected terraformResource: IInterpolatingParent,
    protected terraformAttribute: string,
    protected wrapsSet: boolean
  ) {
    super(terraformResource, terraformAttribute, wrapsSet);
  }

  public get(index: number) {
    return new AnyMap(this, `[${index}]`);
  }
}
