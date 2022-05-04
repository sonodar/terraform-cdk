import { Language } from "@cdktf/provider-generator";
import { ProviderDependencySpec } from "../cdktf-config";
import { Errors } from "../errors";
import { logger } from "../logging";
import { CdktfConfigManager } from "./cdktf-config-manager";
import { PackageManager } from "./package-manager";
import {
  getNpmPackageName,
  getPrebuiltProviderVersion,
} from "./prebuilt-providers";
import { getLatestVersion } from "./registry-api";
import { versionMatchesConstraint } from "./version-constraints";

// ref: https://www.terraform.io/language/providers/requirements#source-addresses
const DEFAULT_HOSTNAME = "registry.terraform.io";
const DEFAULT_NAMESPACE = "hashicorp";
function normalizeProviderSource(source: string) {
  // returns <HOSTNAME>/<NAMESPACE>/<TYPE>
  const slashes = source.split("/").length - 1;
  switch (slashes) {
    case 0:
      return `${DEFAULT_HOSTNAME}/${DEFAULT_NAMESPACE}/${source}`;
    case 1:
      return `${DEFAULT_HOSTNAME}/${source}`;
    default:
      return source;
  }
}

export class ProviderConstraint {
  /**
   * normalized source of the provider
   * e.g. "registry.terraform.io/hashicorp/aws"
   */
  public readonly source: string;

  // TODO: parse the version constraint, add examples to cli command description (i.e. =,~>.> etc.)
  // if no version constraint is specified, we assume the latest version
  // if specific version is specified without e.g. =, we allow patch level increments (e.g. ~>2.12 for "2.12")
  constructor(source: string, public readonly version: string | undefined) {
    this.source = normalizeProviderSource(source);
  }

  static fromConfigEntry(
    provider: string | ProviderDependencySpec
  ): ProviderConstraint {
    if (typeof provider === "string") {
      const [src, version] = provider.split("@");
      return new ProviderConstraint(src, version);
    }

    const src =
      (provider.namespace ? `${provider.namespace}/` : "") +
      (provider.source || provider.name);

    return new ProviderConstraint(src, provider.version);
  }

  public isFromTerraformRegistry(): boolean {
    return this.hostname === DEFAULT_HOSTNAME;
  }

  /**
   * the namespace of the provider
   * e.g. "hashicorp" or "kreuzwerker"
   */
  public get namespace(): string {
    return this.source.split("/")[1];
  }

  /**
   * the name of the provider
   * e.g. "aws"
   */
  public get name(): string {
    return this.source.split("/")[2];
  }

  /**
   * the hostname of the provider
   * e.g. "registry.terraform.io"
   */
  public get hostname(): string {
    return this.source.split("/")[0];
  }

  /**
   * returns a simplified provider name, dropping namespace and hostname
   * if they match the defaults
   */
  public get simplifiedName(): string {
    return this.source
      .split("/")
      .filter((part) => part !== DEFAULT_HOSTNAME && part !== DEFAULT_NAMESPACE)
      .join("/");
  }

  /**
   * checks if the version constraint matches the given version
   * @param version an actual version (e.g. "4.12.1")
   * @returns true if the version is compatible with the constraint
   */
  public matchesVersion(version: string): boolean {
    if (this.version) {
      return versionMatchesConstraint(version, this.version);
    }
    return true;
  }
}

/**
 * manages dependencies of a CDKTF project (e.g. terraform providers)
 */
export class DependencyManager {
  private packageManager: PackageManager;

  constructor(
    private readonly targetLanguage: Language,
    private cdktfVersion: string,
    private readonly projectDirectory: string
  ) {
    this.packageManager = PackageManager.forLanguage(
      targetLanguage,
      this.projectDirectory
    );
  }

  async addProvider(constraint: ProviderConstraint) {
    if (await this.hasPrebuiltProvider(constraint)) {
      return this.addPrebuiltProvider(constraint);
    } else {
      return this.addLocalProvider(constraint);
    }
  }

  async hasPrebuiltProvider(constraint: ProviderConstraint): Promise<boolean> {
    logger.debug(
      `determining whether pre-built provider exists for ${constraint.source} with version constraint ${constraint.version} and cdktf version ${this.cdktfVersion}`
    );

    console.log(`Checking whether pre-built provider exists for the following constraints:
  provider: ${constraint.simplifiedName}
  version : ${constraint.version || "latest"}
  language: ${this.targetLanguage}
  cdktf   : ${this.cdktfVersion}
`);

    if (this.targetLanguage === Language.GO) {
      console.log(
        `There are no pre-built providers published for Go at the moment. See https://github.com/hashicorp/terraform-cdk/issues/723`
      );
      return false;
    }

    const v = await getPrebuiltProviderVersion(constraint);
    const exists = v !== undefined;

    console.log(
      `Pre-built provider ${
        exists ? "does" : "does not"
      } exist for the given constraints.`
    );

    return exists;
  }

  async addPrebuiltProvider(constraint: ProviderConstraint) {
    logger.debug(
      `adding pre-built provider ${constraint.source} with version constraint ${constraint.version} for cdktf version ${this.cdktfVersion}`
    );

    if (this.targetLanguage === Language.GO) {
      throw Errors.Usage(
        "There are no pre-built providers published for Go at the moment. See https://github.com/hashicorp/terraform-cdk/issues/723"
      );
    }

    const npmPackageName = await getNpmPackageName(constraint);

    if (!npmPackageName) {
      throw Errors.Usage(
        `Could not find pre-built provider for ${constraint.source}`
      );
    }

    const packageName = this.convertPackageName(npmPackageName);
    // FIXME: also use this.cdktfVersion
    const prebuiltProviderVersion = await getPrebuiltProviderVersion(
      constraint
    );
    if (!prebuiltProviderVersion) {
      throw Errors.Usage(
        `No pre-built provider found for ${constraint.source} with version constraint ${constraint.version}`
      );
    }

    const packageVersion = prebuiltProviderVersion; // TODO: allow patch level increments as that is what we allow in between CDKTF releases?

    this.packageManager.addPackage(packageName, packageVersion);

    // TODO: more debug logs
  }

  async addLocalProvider(constraint: ProviderConstraint) {
    logger.debug(
      `adding local provider ${constraint.source} with version constraint ${constraint.version}`
    );

    if (!constraint.version && constraint.isFromTerraformRegistry()) {
      const v = await getLatestVersion(constraint);
      if (v) {
        constraint = new ProviderConstraint(
          constraint.source,
          // "1.3.2" -> "~> 1.3"
          `~> ${v.split(".").slice(0, 2).join(".")}`
        );
      }
    }

    new CdktfConfigManager().addProvider(constraint);
  }

  /**
   * Converts an NPM package name of a pre-built provider package to the name in the target language
   */
  private convertPackageName(name: string): string {
    switch (this.targetLanguage) {
      case Language.GO:
        throw new Error("pre-built providers are not supported for Go yet");
      case Language.TYPESCRIPT:
        return name; // already the correct name
      default:
        throw new Error(
          `converting package name for language ${this.targetLanguage} not implemented yet`
        );
    }
  }
}
