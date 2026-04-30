import * as React from 'react';
import { Body, Container, Head, Heading, Html, Link, Preview, Text } from '@react-email/components';
import { body, button, container, h1, text, textMuted } from '../_styles';

type Props = {
  name: string;
  dashboardUrl: string;
};

export default function Welcome({ name, dashboardUrl }: Props) {
  return (
    <Html>
      <Head />
      <Preview>Welcome to Middlemist</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={h1}>Welcome, {name}.</Heading>
          <Text style={text}>
            Middlemist is now set up for your work. Add a client, write a proposal, track time, and
            send invoices — all from one place.
          </Text>
          <Link href={dashboardUrl} style={button}>
            Open dashboard
          </Link>
          <Text style={textMuted}>— Middlemist</Text>
        </Container>
      </Body>
    </Html>
  );
}
