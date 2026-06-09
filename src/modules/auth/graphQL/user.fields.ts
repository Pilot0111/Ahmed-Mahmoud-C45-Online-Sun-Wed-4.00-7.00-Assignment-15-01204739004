import { GraphQLString, GraphQLList } from "graphql";
import { UserType } from "./userType";
import authService from "../auth.service";
import { createUserArgs, getUserArgs } from "./user.args";
import { AuthGraphQL } from "../../../common/utils/security/auth.gql";
import { RoleEnum } from "../../../common/enum/user.enum";
import { Validation_GQL } from "../../../common/middleware/validation";
import { signUpSchema } from "../user.validation";

export class UserFields {
  constructor() {}
  query = () => {
    return {
      hello: {
        type: GraphQLString,
        resolve: () => "Hello world",
      },
      getUser: {
        type: UserType,
        args: getUserArgs(),
        resolve: async (parent: any, args: any, { req }: any) => {
          // Authenticate inside the resolver
          const { user } = await AuthGraphQL.authenticate(
            req.headers.authorization,
          );

          // Fallback to the authenticated user's ID if no ID is provided in args
          const id = args.id || user._id;
          return authService.getUser(parent, { id });
        },
      },
      listUsers: {
        type: new GraphQLList(UserType),
        resolve: async (parent: any, args: any, { req }: any, info: any) => {
          // Authenticate inside the resolver
          const { user } = await AuthGraphQL.authenticate(
            req.headers.authorization,
          );
          // Authorize: Only Admin can list all users
          AuthGraphQL.authorize(user.role as RoleEnum, [RoleEnum.admin]);
          console.log("Request Headers:", req.headers); // Access headers directly from destructured req
          return authService.listUsers();
        },
      },
    };
  };

  mutation = () => {
    return {
      createUser: {
        type: UserType,
        args: createUserArgs(),
        resolve: async (parent: any, args: any) => {
          // Validate the incoming arguments against the Zod schema
          await Validation_GQL(signUpSchema.body, args);
          return authService.createUser(parent, args);
        },
      },
    };
  };
}

// Export the actual fields object so the schema can use it
export default new UserFields();
