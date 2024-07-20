import { NearBindgen, near, call, view } from 'near-sdk-js';
import { MessageSchema, POINT_ONE, PostedMessage } from './model';
import * as borsh from 'borsh';

@NearBindgen({
  serializer(value) {
    return borsh.serialize(schema, value);
  },
  deserializer(value) {
    return borsh.deserialize(schema, value);
  },
})
class GuestBook {
  messages: Array<PostedMessage> = [];

  @call({ payableFunction: true })
  // Public - Adds a new message.
  add_message({ text }: { text: string }) {
    // If the user attaches more than 0.1N the message is premium
    const premium = near.attachedDeposit() >= BigInt(POINT_ONE);
    const sender = near.predecessorAccountId();

    const message: PostedMessage = { premium, sender, text };
    this.messages.push(message);
  }

  @view({})
  // Returns an array of messages.
  get_messages({ from_index = 0, limit = 10 }: { from_index: number, limit: number }): PostedMessage[] {
    return this.messages.slice(from_index, from_index + limit);
  }

  @view({})
  total_messages(): number { return this.messages.length }
}

const schema: borsh.Schema = {
  struct: {
    messages: {
      array: {
        type: MessageSchema,
      },
    },
  },
};
