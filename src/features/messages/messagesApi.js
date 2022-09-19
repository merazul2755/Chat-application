import { io } from "socket.io-client";
import { apiSlice } from "../api/apiSlice";

export const messagesApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getMessages: builder.query({
      query: (id) =>
        `/messages?conversationId=${id}&_sort=timestamp&_order=desc&_page=1&_limit=${process.env.REACT_APP_MESSAGES_PER_PAGE}`,
      transformResponse(apiResponse, meta) {
        const totalCount = meta.response.headers.get("X-Total-Count");
        return {
          data: apiResponse,
          totalCount,
        };
      },
      async onCacheEntryAdded(
        arg,
        { updateCachedData, cacheDataLoaded, cacheEntryRemoved }
      ) {
        // console.log("hello");
        // create socket
        const socket = io(`${process.env.REACT_APP_API_URL}`, {
          reconnectionDelay: 1000,
          reconnection: true,
          reconnectionAttemps: 10,
          transports: ["websocket"],
          agent: false,
          upgrade: false,
          rejectUnauthorized: false,
        });

        try {
          // console.log("hello 2");
          await cacheDataLoaded;
          // console.log("hello 3");
          socket.on("message", (data) => {
            // console.log("data");
            updateCachedData((draft) => {
              // console.log(data);
              // console.log(JSON.stringify(draft));
              const conversation = draft.data.find(
                // eslint-disable-next-line eqeqeq
                (c) => c.conversationId == data?.data?.conversationId
              );

              if (conversation?.id) {
                draft.data.push(data.data);
              } else {
                // do nothing
              }
            });
          });
        } catch (err) {}

        await cacheEntryRemoved;
        socket.close();
      },
    }),
    addMessage: builder.mutation({
      query: (data) => ({
        url: "/messages",
        method: "POST",
        body: data,
      }),
    }),
    getMoreMessages: builder.query({
      query: ({ id, page }) =>
        `/messages?conversationId=${id}&_sort=timestamp&_order=desc&_page=${page}&_limit=${process.env.REACT_APP_MESSAGES_PER_PAGE}`,
      async onQueryStarted({ id }, { queryFulfilled, dispatch }) {
        try {
          const messages = await queryFulfilled;
          if (messages?.data?.length > 0) {
            // update conversation cache pessimistically start
            dispatch(
              apiSlice.util.updateQueryData("getMessages", id, (draft) => {
                return {
                  data: [...draft.data, ...messages.data],
                  totalCount: Number(draft.totalCount),
                };
              })
            );
            // update messages cache pessimistically end
          }
        } catch (err) {}
      },
    }),
  }),
});

export const { useGetMessagesQuery, useAddMessageMutation } = messagesApi;
