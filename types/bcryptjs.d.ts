declare module "bcryptjs" {
  const bcrypt: {
    compare(value: string, encrypted: string): Promise<boolean>;
    hash(value: string, salt: number | string): Promise<string>;
  };

  export default bcrypt;
}
